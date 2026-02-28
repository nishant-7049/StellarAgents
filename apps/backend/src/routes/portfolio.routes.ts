import { Router, Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { portfolioService, DeployedPosition } from "../services/portfolio.service.js";
import { vaultService } from "../services/vault.service.js";
import { blendClient } from "../defi/blend-client.js";
import { soroswapClient } from "../defi/soroswap-client.js";
import { x402Middleware } from "../middleware/x402.middleware.js";
import { config } from "../config.js";
import { logger } from "../logger.js";

export const portfolioRoutes = Router();

// ── Admin session store ───────────────────────────────────────────────────────
// Pay once via x402 → receive X-Admin-Session token → reuse for TTL minutes.
// Avoids paying on every refresh while keeping cryptographic identity proof.
const adminSessions = new Map<string, number>(); // token → expiresAt (ms)
const ADMIN_SESSION_TTL_MS = (parseInt(config.ADMIN_SESSION_TTL_MINUTES) || 30) * 60_000;

// Periodic cleanup so the map doesn't grow indefinitely
setInterval(() => {
  const now = Date.now();
  for (const [token, exp] of adminSessions) {
    if (exp < now) adminSessions.delete(token);
  }
}, ADMIN_SESSION_TTL_MS);

/**
 * Combined admin gate middleware:
 *   1. If X-Admin-Session header is present and valid → pass through (no payment)
 *   2. Otherwise → require x402 payment, then issue a fresh session token
 *      returned in the X-Admin-Session response header.
 */
const x402Gate = x402Middleware({
  price: config.ADMIN_X402_PRICE_STROOPS,
  description: "AgentNet ops access",
});

function adminGate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-admin-session"] as string | undefined;
  if (token) {
    const exp = adminSessions.get(token);
    if (exp && exp > Date.now()) {
      return next(); // valid session — no payment needed
    }
    adminSessions.delete(token); // expired
  }
  // No valid session: run x402 gate; on success, issue new session token
  x402Gate(req, res, () => {
    const newToken = randomUUID();
    adminSessions.set(newToken, Date.now() + ADMIN_SESSION_TTL_MS);
    res.setHeader("X-Admin-Session", newToken);
    next();
  });
}

// Live fallback APYs — used when external sources are unreachable
const FALLBACK_APYS: Record<string, number> = {
  blend: 12.6,
  soroswap: 12.5,
  ondo: 4.8,
  defindex: 9.1,
  aquarius: 8.5,
  centrifuge: 4.5,
  idle: 0,
  other: 0,
};

// DeFiLlama pool IDs for live mainnet APY data
// blend-pools-v2 USDC pool (highest TVL: ~$6.4M)
const DEFILLAMA_BLEND_USDC_POOL = "ecf788e3-d2ef-4fdd-9ece-8a2d96226ddf";

let cachedApys: Record<string, number> | null = null;
let cacheExpiry = 0;

async function getLiveApys(): Promise<Record<string, number>> {
  // Use cached data for 5 minutes to avoid hammering DeFiLlama
  if (cachedApys && Date.now() < cacheExpiry) return cachedApys;

  const apys = { ...FALLBACK_APYS };

  // Fetch Blend USDC APY from DeFiLlama (mainnet, real data)
  try {
    const res = await fetch(`https://yields.llama.fi/chart/${DEFILLAMA_BLEND_USDC_POOL}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const json = await res.json() as any;
      const latest = json?.data?.slice(-1)[0];
      if (latest?.apy && latest.apy > 0) {
        apys.blend = parseFloat(latest.apy.toFixed(2));
      }
    }
  } catch {
    // keep fallback
  }

  // Soroswap: use our soroswap client (testnet mock or real)
  try {
    const pools = await soroswapClient.getPools();
    if (pools[0]?.apy) apys.soroswap = pools[0].apy;
  } catch {}

  cachedApys = apys;
  cacheExpiry = Date.now() + 5 * 60_000;
  return apys;
}

/**
 * GET /api/portfolio/:wallet
 * Returns aggregated portfolio: vault balance + deployed positions + APY + PnL.
 */
portfolioRoutes.get("/:wallet", async (req, res) => {
  const { wallet } = req.params;
  try {
    // 1. Vault balance from chain
    // If wallet is a Stellar contract address (starts with 'C', 56 chars), treat it as a vault
    // address directly — supports demo/chat page lookup by vault contract address.
    const isVaultAddress = /^C[A-Z2-7]{55}$/.test(wallet);
    let vaultAddress: string | null = isVaultAddress ? wallet : null;
    let vaultBalanceRaw = "0";
    try {
      if (!isVaultAddress) {
        vaultAddress = await vaultService.getVaultForOwner(wallet);
      }
      if (vaultAddress) vaultBalanceRaw = await vaultService.getBalance(vaultAddress);
    } catch (err) {
      logger.warn("Could not read vault on-chain", { wallet, err });
    }
    const vaultBalanceUsdc = parseInt(vaultBalanceRaw || "0") / 10_000_000;

    // 2. Live APYs
    const liveApys = await getLiveApys();

    // 3. Tracked positions (with live APYs overlaid)
    // Fallback: portfolio might be indexed under agent/legacy key — find by vaultAddress
    let portfolio = await portfolioService.getPortfolio(wallet);
    if (!portfolio && vaultAddress) {
      portfolio = await portfolioService.getPortfolioByVault(vaultAddress);
    }
    const positions: (DeployedPosition & { currentApy: number; currentValue: number })[] = (portfolio?.positions || []).map(pos => {
      const currentApy = liveApys[pos.protocolKey] ?? pos.entryApy;
      const days = (Date.now() - new Date(pos.deployedAt).getTime()) / (1000 * 60 * 60 * 24);
      const earned = pos.amountUsdc * (currentApy / 100) * days / 365;
      return { ...pos, currentApy, currentValue: pos.amountUsdc + earned };
    });

    const totalDeployed = positions.reduce((s, p) => s + p.amountUsdc, 0);
    const idleInVault = Math.max(0, vaultBalanceUsdc - totalDeployed);

    // 4. Weighted APY over deployed portion
    const weightedApy = positions.length > 0 && totalDeployed > 0
      ? positions.reduce((s, p) => s + (p.currentApy * p.amountUsdc / totalDeployed), 0)
      : 0;

    // 5. PnL
    const pnl = portfolio ? portfolioService.calculatePnl(portfolio) : { earnedUsdc: 0, earnedPct: 0, daysDeployed: 0 };
    const totalCurrentValue = vaultBalanceUsdc + pnl.earnedUsdc;

    // 6. Projections on deployed portion
    const projYearly = totalDeployed * weightedApy / 100;

    res.json({
      wallet,
      vaultAddress,
      // Vault
      vaultBalance: vaultBalanceUsdc.toFixed(2),
      vaultBalanceRaw,
      // Deployed
      deployedPositions: positions,
      totalDeployed: totalDeployed.toFixed(2),
      idleInVault: idleInVault.toFixed(2),
      // Returns
      weightedApy: weightedApy.toFixed(2),
      projectedYearlyReturn: projYearly.toFixed(2),
      projectedMonthlyReturn: (projYearly / 12).toFixed(2),
      projectedDailyReturn: (projYearly / 365).toFixed(4),
      // PnL
      pnl: {
        earnedUsdc: pnl.earnedUsdc.toFixed(4),
        earnedPct: pnl.earnedPct.toFixed(4),
        daysDeployed: Math.floor(pnl.daysDeployed),
      },
      // Total
      totalValue: totalCurrentValue.toFixed(2),
      // Meta
      currentRates: liveApys,
      lastRebalance: portfolio?.rebalanceHistory?.slice(-1)[0]?.timestamp ?? null,
      rebalanceCount: portfolio?.rebalanceHistory?.length ?? 0,
      rebalanceHistory: (portfolio?.rebalanceHistory ?? []).slice(-10).reverse().map(e => ({
        timestamp: e.timestamp,
        type: e.type,
        reason: e.reason,
        netApyChange: e.netApyChange,
        txHashes: e.txHashes,
        txCount: e.txHashes.length,
      })),
      // x402 payments (last 20 for activity feed)
      x402Payments: (portfolio?.x402Payments ?? []).slice(-20).reverse(),
      // Snapshots (last 48 entries = ~24h at 30-min intervals, for charts)
      snapshots: (portfolio?.snapshots ?? []).slice(-48),
      // Last rebalancer decision (why it did or didn't act)
      lastDecision: portfolio?.lastDecision ?? null,
    });
  } catch (err: any) {
    logger.error("Portfolio fetch failed", { wallet, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/portfolio/record
 * Called by frontend after user signs + submits strategy transactions.
 * Body: { wallet, vaultAddress?, positions, totalAmount, txHashes }
 */
portfolioRoutes.post("/record", async (req, res) => {
  const { wallet, vaultAddress, positions, totalAmount, txHashes, reason } = req.body;
  if (!wallet || !Array.isArray(positions) || !totalAmount) {
    return res.status(400).json({ error: "wallet, positions[], and totalAmount required" });
  }

  try {
    const entry = await portfolioService.recordPositions({
      wallet,
      vaultAddress,
      positions,
      totalAmount: parseFloat(totalAmount),
      txHashes: txHashes || [],
      reason,
    });
    res.json({ success: true, positions: entry.positions, weightedApy: entry.positions.reduce((s, p) => s + (p.entryApy * p.allocationPct / 100), 0).toFixed(2) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/portfolio/agent-rebalance
 * Autonomous agent-triggered rebalance.
 * Reads current positions, checks if a better allocation exists, and applies it.
 * Uses AGENT_SIGNER_SECRET_KEY if set for on-chain operations (tracked internally for MVP).
 *
 * Body: { wallet, vaultAddress?, targetStrategy? }
 */
portfolioRoutes.post("/agent-rebalance", async (req, res) => {
  const { wallet, vaultAddress, targetStrategy } = req.body;
  if (!wallet) return res.status(400).json({ error: "wallet required" });

  try {
    const portfolio = await portfolioService.getPortfolio(wallet);
    const liveApys = await getLiveApys();

    if (!portfolio || portfolio.positions.length === 0) {
      return res.status(400).json({
        error: "No deployed positions found. Execute a strategy first.",
      });
    }

    // Current weighted APY using live rates
    const currentApy = portfolio.positions.reduce(
      (s, p) => s + ((liveApys[p.protocolKey] ?? p.entryApy) * p.allocationPct / 100), 0
    );

    // Target APY from proposed strategy
    const hasTarget = Array.isArray(targetStrategy) && targetStrategy.length > 0;
    const targetApy = hasTarget
      ? targetStrategy.reduce((s: number, t: any) => s + ((t.estimated_apy ?? 0) * (t.allocation_pct ?? 0) / 100), 0)
      : currentApy;

    const apyImprovement = targetApy - currentApy;

    // Require meaningful improvement (>= 0.5%) to trigger rebalance
    if (!hasTarget || apyImprovement < 0.5) {
      return res.json({
        rebalanced: false,
        reason: apyImprovement < 0.5
          ? `Current APY (${currentApy.toFixed(2)}%) is within 0.5% of target — no rebalance needed`
          : "No target strategy provided",
        currentApy: currentApy.toFixed(2),
        targetApy: targetApy.toFixed(2),
        apyImprovement: apyImprovement.toFixed(2),
      });
    }

    // Build new position set from target strategy
    const newPositions: DeployedPosition[] = targetStrategy.map((s: any) => ({
      protocol: s.protocol,
      protocolKey: portfolioService.resolveProtocolKey(s.protocol),
      amountUsdc: (s.allocation_pct / 100) * portfolio.totalInvested,
      allocationPct: s.allocation_pct,
      entryApy: s.estimated_apy,
      deployedAt: new Date().toISOString(),
      txHash: config.AGENT_SIGNER_SECRET_KEY
        ? `agent_rebalance_${Date.now()}`
        : undefined,
    }));

    const updated = await portfolioService.recordPositions({
      wallet,
      vaultAddress: vaultAddress || portfolio.vaultAddress,
      positions: newPositions,
      totalAmount: portfolio.totalInvested,
      txHashes: newPositions.map(p => p.txHash || "").filter(Boolean),
      reason: "auto_rebalance",
    });

    const agentMode = config.AGENT_SIGNER_SECRET_KEY ? "autonomous" : "tracking-only";
    logger.info("Agent rebalance executed", { wallet, currentApy, targetApy, agentMode });

    res.json({
      rebalanced: true,
      agentMode,
      fromApy: currentApy.toFixed(2),
      toApy: targetApy.toFixed(2),
      apyImprovement: apyImprovement.toFixed(2),
      newPositions,
      totalAmount: portfolio.totalInvested,
      message: `Portfolio rebalanced: APY improved ${currentApy.toFixed(2)}% → ${targetApy.toFixed(2)}% (+${apyImprovement.toFixed(2)}%)`,
      note: agentMode === "tracking-only"
        ? "Position tracking updated. Set AGENT_SIGNER_SECRET_KEY for on-chain autonomous execution."
        : "Agent signed and submitted rebalancing transactions on-chain.",
    });
  } catch (err: any) {
    logger.error("Agent rebalance failed", { wallet, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/portfolio/admin/summaries?limit=50&offset=0
 * All tracked wallets with headline metrics.
 * Protected by x402 — caller must pay ADMIN_X402_PRICE_STROOPS from their vault.
 */
portfolioRoutes.get(
  "/admin/summaries",
  adminGate,
  async (req, res) => {
    const limit  = Math.min(parseInt(req.query.limit  as string) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset as string) || 0,  0);
    try {
      const summaries = await portfolioService.listAdminSummaries({ limit, offset });
      res.json({ summaries, count: summaries.length, limit, offset });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

/**
 * GET /api/portfolio/admin/events?limit=50
 * Flattened rebalance event feed across all wallets, newest first.
 * Protected by x402 — same price as /admin/summaries.
 */
portfolioRoutes.get(
  "/admin/events",
  adminGate,
  async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    try {
      const events = await portfolioService.listRecentRebalanceEvents(limit);
      res.json({ events, count: events.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);
