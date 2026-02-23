import { Router } from "express";
import { buildX402Header } from "../x402/header-builder.js";
import { config } from "../config.js";
import { Keypair } from "@stellar/stellar-sdk";
import { logger } from "../logger.js";

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
