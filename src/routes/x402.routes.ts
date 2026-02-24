import { Router } from "express";
import { z } from "zod";
import { buildX402Header } from "../x402/header-builder.js";
import { settlePayment } from "../x402/facilitator.js";
import { portfolioService } from "../services/portfolio.service.js";
import { config } from "../config.js";
import { Keypair } from "@stellar/stellar-sdk";
import { logger } from "../logger.js";

const STELLAR_ADDRESS = /^[CG][A-Z2-7]{55}$/;
const G_ADDRESS       = /^G[A-Z2-7]{55}$/;   // keypair accounts only (no contracts)

const SettleSchema = z.object({
  x402Version: z.literal(1),
  scheme: z.literal("stellar-vault"),
  network: z.enum(["stellar:testnet", "stellar:mainnet"]),
  payload: z.object({
    vaultContract:    z.string().regex(STELLAR_ADDRESS),
    agentId:          z.number().int().positive(),
    agentSigner:      z.string().regex(STELLAR_ADDRESS),
    payTo:            z.string().regex(G_ADDRESS),   // payment destination must be an account, not a contract
    amount:           z.string().regex(/^\d+$/),
    asset:            z.string().min(1),
    memo:             z.string().max(28),
    signedAuthEntry:  z.string().min(1),
    assembledTxXdr:   z.string().optional(),
    expirationLedger: z.number().int().positive(),
  }).strict(),
}).strict();

const rateLimitMap = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;

// Prune entries whose entire window has expired to prevent unbounded map growth
setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW_MS;
  for (const [k, v] of rateLimitMap) {
    if (v.every(t => t < cutoff)) rateLimitMap.delete(k);
  }
}, RATE_WINDOW_MS);

export const x402Routes = Router();

/**
 * POST /api/x402/build-header
 *
 * Builds a real x402 payment header for the frontend.
 * The frontend calls this before retrying a 402'd request.
 *
 * Body: { vaultContract, payTo, amount, memo }
 * Returns: { header: "base64..." }
 */
x402Routes.post("/build-header", async (req, res) => {
  try {
    const { vaultContract, payTo, amount, memo } = req.body;

    if (!vaultContract || !payTo || !amount) {
      return res.status(400).json({ error: "Missing required fields: vaultContract, payTo, amount" });
    }

    if (!config.AGENT_SIGNER_SECRET_KEY) {
      return res.status(500).json({ error: "Agent signer key not configured" });
    }

    const agentPub = Keypair.fromSecret(config.AGENT_SIGNER_SECRET_KEY).publicKey();

    const header = await buildX402Header({
      vaultContract,
      agentSigner: agentPub,
      agentSecret: config.AGENT_SIGNER_SECRET_KEY,
      payTo: payTo,
      amount: amount.toString(),
      memo: memo || "yield_query",
      agentId: 1,
    });

    logger.info("Built x402 header", { vaultContract, amount });
    res.json({ header });
  } catch (err: any) {
    logger.error("Failed to build x402 header", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/x402/settle
 *
 * Called by the SDK's BlendClient.executeViaVault() to submit a signed
 * vault.agent_pay() authorization entry on-chain.
 *
 * Body: x402 payment payload with signedAuthEntry
 * Returns: { success: true, txHash } | { success: false, error }
 */
x402Routes.post("/settle", async (req, res) => {
  // 1. Schema validation
  const parsed = SettleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
  }
  const data = parsed.data;

  // 2. Amount cap
  const maxAmount = BigInt(config.MAX_SETTLE_AMOUNT_STROOPS);
  if (BigInt(data.payload.amount) > maxAmount) {
    return res.status(400).json({ success: false, error: "amount exceeds per-call cap" });
  }

  // 3. payTo whitelist (skip if not configured)
  const whitelist = config.SETTLE_PAY_TO_WHITELIST
    ? config.SETTLE_PAY_TO_WHITELIST.split(",").map(s => s.trim()).filter(Boolean)
    : [];
  if (whitelist.length > 0 && !whitelist.includes(data.payload.payTo)) {
    return res.status(400).json({ success: false, error: "payTo address not whitelisted" });
  }

  // 4. Rate limit
  const signer = data.payload.agentSigner;
  const now = Date.now();
  const recent = (rateLimitMap.get(signer) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    return res.status(429).json({ success: false, error: "rate limit exceeded" });
  }
  if (recent.length === 0) {
    rateLimitMap.delete(signer); // don't keep an empty entry for signers outside the window
  }
  rateLimitMap.set(signer, [...recent, now]);

  // 5. Settle
  try {
    const result = await settlePayment(data);
    // Transient upstream failures are retryable — use 503 so clients know to retry
    const httpStatus = result.success ? 200
      : (
          result.error?.startsWith("timeout:") ||
          result.error?.startsWith("horizon:") ||
          result.error === "send: TRY_AGAIN_LATER"  // RPC explicitly says retry
        ) ? 503
      : 400;

    // Record payment against the vault's portfolio (best-effort, don't block response)
    const paymentStatus = result.success ? "settled"
      : (httpStatus === 503) ? "unknown"
      : "failed";
    const memo = data.payload.memo ?? "";
    const purpose = memo.startsWith("rebalance") ? "rebalance_check"
      : memo.startsWith("execute") ? "execute"
      : "yield_query";
    portfolioService.recordPaymentByVault(data.payload.vaultContract, {
      purpose,
      amountStroops: parseInt(data.payload.amount),
      txHash: result.txHash,
      status: paymentStatus,
    }).catch(() => {});

    res.status(httpStatus).json(result);
  } catch (err: any) {
    logger.error("x402 settle failed", { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});
