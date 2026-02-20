/**
 * Autonomous Rebalancer
 *
 * Runs on a cron schedule. For every wallet with tracked positions:
 *
 * MODE A (AGENT_SIGNER_SECRET_KEY set — fully autonomous x402):
 *   1. Agent builds an x402 payment header using the user's vault + agent key
 *   2. Agent calls POST /api/yield/query — x402 middleware settles 0.01 USDC from vault
 *   3. AI returns the optimal strategy
 *   4. If APY improves ≥ threshold, positions are updated
 *   → USDC flows: user's vault → facilitator (platform fee for AI intelligence)
 *
 * MODE B (no agent key — fallback algorithmic):
 *   1. Load live APYs from Blend/Soroswap directly
 *   2. Shift allocation toward highest-APY protocol (simple heuristic)
 *   → No x402, no AI — useful for demo without secret keys
 *
 * This is the core x402 use case: an agent autonomously pays for its own intelligence.
 */
import cron from "node-cron";
import { Keypair } from "@stellar/stellar-sdk";
import { blendClient } from "./blend-client.js";
import { soroswapClient } from "./soroswap-client.js";
import { portfolioService, DeployedPosition } from "../services/portfolio.service.js";
import { buildX402Header } from "../x402/header-builder.js";
import { config } from "../config.js";
import { logger } from "../logger.js";

const DRIFT_THRESHOLD_PCT = parseFloat(config.REBALANCE_DRIFT_THRESHOLD_PCT || "0.5");
const BACKEND_URL = `http://localhost:${config.PORT || "3001"}`;

let rebalanceCount = 0;
let x402PaymentCount = 0;
let lastRunAt: string | null = null;
let isRunning = false;

// ── Live APY helpers ──────────────────────────────────────────────────────────

const FALLBACK_APYS: Record<string, number> = {
  blend: 7.2, soroswap: 12.5, ondo: 4.8,
  defindex: 9.1, aquarius: 8.5, centrifuge: 4.5, idle: 0, other: 0,
};

async function getLiveApys(): Promise<Record<string, number>> {
  const apys = { ...FALLBACK_APYS };
  try {
    const blend = await blendClient.loadPool();
    if (blend.reserves[0]?.supplyApy) apys.blend = blend.reserves[0].supplyApy;
  } catch {}
  try {
    const pools = await soroswapClient.getPools();
    if (pools[0]?.apy) apys.soroswap = pools[0].apy;
  } catch {}
  return apys;
}

// ── MODE A: x402-authenticated AI strategy call ───────────────────────────────

/**
 * Agent autonomously pays 0.01 USDC via x402 to get an AI-powered strategy.
 * Returns the strategy if the call succeeds, null otherwise.
 */
async function queryAIWithX402(wallet: string, vaultAddress: string, totalAmount: number) {
  try {
    const agentKeypair = Keypair.fromSecret(config.AGENT_SIGNER_SECRET_KEY!);
    const facilitatorPubkey = config.FACILITATOR_SECRET_KEY
      ? Keypair.fromSecret(config.FACILITATOR_SECRET_KEY).publicKey()
      : agentKeypair.publicKey();

    // Agent builds the x402 payment header — autonomous vault payment
    const paymentHeader = await buildX402Header({
      vaultContract: vaultAddress,
      agentSigner: agentKeypair.publicKey(),
      agentSecret: config.AGENT_SIGNER_SECRET_KEY!,
      payTo: facilitatorPubkey,
      amount: "100000", // 0.01 USDC in stroops
      memo: `rebalance_${Date.now()}`,
      agentId: 1,
    });

    // Call the x402-gated AI endpoint — middleware settles payment on-chain
    const response = await fetch(`${BACKEND_URL}/api/yield/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PAYMENT": paymentHeader,
      },
      body: JSON.stringify({
        query: `optimize yield for ${totalAmount} USDC portfolio, rebalance check`,
        risk_tolerance: "moderate",
        amount: totalAmount,
        wallet,
      }),
    });

    if (!response.ok) {
      logger.warn(`Rebalancer x402 call failed: ${response.status} for ${wallet.slice(0, 8)}…`);
      return null;
    }

    const data = await response.json();
    x402PaymentCount++;
    logger.info(`Rebalancer x402 payment settled for ${wallet.slice(0, 8)}…`, {
      txHash: data.x402?.txHash,
      strategies: data.strategies?.length,
    });
    return data;
  } catch (err) {
    logger.error("Rebalancer x402 query failed", { err });
    return null;
  }
}

// ── MODE B: Algorithmic rebalance (no x402) ───────────────────────────────────

function buildAlgorithmicRebalance(
  current: DeployedPosition[],
  liveApys: Record<string, number>,
  totalAmount: number,
): DeployedPosition[] {
  if (current.length < 2) {
    return current.map(p => ({
      ...p, entryApy: liveApys[p.protocolKey] ?? p.entryApy,
      deployedAt: new Date().toISOString(),
    }));
  }
  const ranked = current
    .map(p => ({ ...p, liveApy: liveApys[p.protocolKey] ?? p.entryApy }))
    .sort((a, b) => b.liveApy - a.liveApy);
  const shift = Math.min(20, ranked[ranked.length - 1].allocationPct);
  return ranked.map((p, i) => {
    const newPct = i === 0 ? p.allocationPct + shift
      : i === ranked.length - 1 ? p.allocationPct - shift
      : p.allocationPct;
    return {
      protocol: p.protocol,
      protocolKey: p.protocolKey,
      amountUsdc: (newPct / 100) * totalAmount,
      allocationPct: newPct,
      entryApy: liveApys[p.protocolKey] ?? p.entryApy,
      deployedAt: new Date().toISOString(),
    };
  });
}

// ── Core loop ─────────────────────────────────────────────────────────────────

async function autoRebalanceAll() {
  if (isRunning) return;
  isRunning = true;
  lastRunAt = new Date().toISOString();

  const wallets = portfolioService.getAllWallets();
  if (wallets.length === 0) {
    isRunning = false;
    return;
  }

  const agentMode = config.AGENT_SIGNER_SECRET_KEY ? "x402+AI" : "algorithmic";
  logger.info(`Rebalancer: checking ${wallets.length} wallet(s) [mode: ${agentMode}]`);

  const liveApys = await getLiveApys();

  for (const wallet of wallets) {
    try {
      const portfolio = portfolioService.getPortfolio(wallet);
      if (!portfolio || portfolio.positions.length === 0) continue;

      const currentApy = portfolio.positions.reduce(
        (sum, p) => sum + ((liveApys[p.protocolKey] ?? p.entryApy) * p.allocationPct / 100), 0,
      );

      let newPositions: DeployedPosition[];
      let targetApy: number;
      let paymentTxHash: string | undefined;

      if (config.AGENT_SIGNER_SECRET_KEY && portfolio.vaultAddress) {
        // ── MODE A: Agent pays via x402 to get AI strategy ──
        const aiResult = await queryAIWithX402(wallet, portfolio.vaultAddress, portfolio.totalInvested);

        if (aiResult?.strategies?.length) {
          newPositions = aiResult.strategies
            .filter((s: any) => !s.protocol.toLowerCase().includes("stellaragent"))
            .map((s: any) => ({
              protocol: s.protocol,
              protocolKey: portfolioService.resolveProtocolKey(s.protocol),
              amountUsdc: (s.allocation_pct / 100) * portfolio.totalInvested,
              allocationPct: s.allocation_pct,
              entryApy: s.estimated_apy,
              deployedAt: new Date().toISOString(),
            }));
          targetApy = aiResult.total_estimated_apy ?? newPositions.reduce(
            (sum, p) => sum + (p.entryApy * p.allocationPct / 100), 0,
          );
          paymentTxHash = aiResult.x402?.txHash;
        } else {
          // AI call failed — fall back to algorithmic
          newPositions = buildAlgorithmicRebalance(portfolio.positions, liveApys, portfolio.totalInvested);
          targetApy = newPositions.reduce((sum, p) => sum + (p.entryApy * p.allocationPct / 100), 0);
        }
      } else {
        // ── MODE B: Algorithmic (no key set) ──
        newPositions = buildAlgorithmicRebalance(portfolio.positions, liveApys, portfolio.totalInvested);
        targetApy = newPositions.reduce((sum, p) => sum + (p.entryApy * p.allocationPct / 100), 0);
      }

      const improvement = targetApy - currentApy;

      if (improvement < DRIFT_THRESHOLD_PCT) {
        logger.debug(`Rebalancer: ${wallet.slice(0, 8)}… APY ${currentApy.toFixed(2)}% — no improvement needed (${improvement.toFixed(2)}% < ${DRIFT_THRESHOLD_PCT}%)`);
        continue;
      }

      // Record the auto-rebalance
      portfolioService.recordPositions({
        wallet,
        vaultAddress: portfolio.vaultAddress,
        positions: newPositions,
        totalAmount: portfolio.totalInvested,
        txHashes: paymentTxHash ? [paymentTxHash] : [],
        reason: agentMode === "x402+AI"
          ? `Agent paid 0.01 USDC via x402 for AI strategy (+${improvement.toFixed(2)}% APY)`
          : `Algorithmic rebalance (+${improvement.toFixed(2)}% APY)`,
      });

      rebalanceCount++;
      logger.info(`Rebalancer: auto-rebalanced ${wallet.slice(0, 8)}… ${currentApy.toFixed(2)}% → ${targetApy.toFixed(2)}% [${agentMode}]${paymentTxHash ? ` tx:${paymentTxHash.slice(0, 12)}…` : ""}`);

    } catch (err) {
      logger.error(`Rebalancer: error for ${wallet.slice(0, 8)}…`, { err });
    }
  }

  isRunning = false;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function startRebalancer() {
  const interval = config.REBALANCE_INTERVAL_MINUTES || "5";
  const agentMode = config.AGENT_SIGNER_SECRET_KEY ? "x402+AI (pays per rebalance)" : "algorithmic (no key set)";
  logger.info(`Autonomous rebalancer started — every ${interval} min, threshold ${DRIFT_THRESHOLD_PCT}%, mode: ${agentMode}`);

  cron.schedule(`*/${interval} * * * *`, () => {
    autoRebalanceAll().catch(err => logger.error("Rebalancer tick failed", { err }));
  });
}

export function getRebalancerStatus() {
  return {
    running: true,
    mode: config.AGENT_SIGNER_SECRET_KEY ? "x402+AI" : "algorithmic",
    intervalMinutes: parseInt(config.REBALANCE_INTERVAL_MINUTES || "5"),
    driftThresholdPct: DRIFT_THRESHOLD_PCT,
    rebalanceCount,
    x402PaymentCount,
    lastRunAt,
    trackedWallets: portfolioService.getAllWallets().length,
  };
}

// Kept for backward-compat — yield-optimizer used to call this
export function setTargetAllocation(_targets: any[]) {}
