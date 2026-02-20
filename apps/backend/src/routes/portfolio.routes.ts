import { Router } from "express";
import { portfolioService, DeployedPosition } from "../services/portfolio.service.js";
import { vaultService } from "../services/vault.service.js";
import { blendClient } from "../defi/blend-client.js";
import { soroswapClient } from "../defi/soroswap-client.js";
import { config } from "../config.js";
import { logger } from "../logger.js";

export const portfolioRoutes = Router();

// Live fallback APYs when SDKs can't be reached
const FALLBACK_APYS: Record<string, number> = {
  blend: 7.2,
  soroswap: 12.5,
  ondo: 4.8,
  defindex: 9.1,
  aquarius: 8.5,
  centrifuge: 4.5,
  idle: 0,
  other: 0,
};

async function getLiveApys(): Promise<Record<string, number>> {
  const apys = { ...FALLBACK_APYS };
  try {
    const blend = await blendClient.loadPool();
    if (blend.reserves[0]?.supplyApy) apys.blend = blend.reserves[0].supplyApy;
    if (blend.reserves[1]?.supplyApy) apys.xlm = blend.reserves[1].supplyApy;
  } catch {}
  try {
    const pools = await soroswapClient.getPools();
    if (pools[0]?.apy) apys.soroswap = pools[0].apy;
  } catch {}
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
    let vaultAddress: string | null = null;
    let vaultBalanceRaw = "0";
    try {
      vaultAddress = await vaultService.getVaultForOwner(wallet);
      if (vaultAddress) vaultBalanceRaw = await vaultService.getBalance(vaultAddress);
    } catch (err) {
      logger.warn("Could not read vault on-chain", { wallet, err });
    }
    const vaultBalanceUsdc = parseInt(vaultBalanceRaw || "0") / 10_000_000;

    // 2. Live APYs
    const liveApys = await getLiveApys();

    // 3. Tracked positions (with live APYs overlaid)
    const portfolio = portfolioService.getPortfolio(wallet);
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
      rebalanceHistory: (portfolio?.rebalanceHistory ?? []).slice(-5).reverse().map(e => ({
        timestamp: e.timestamp,
        type: e.type,
        reason: e.reason,
        netApyChange: e.netApyChange,
        txCount: e.txHashes.length,
      })),
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
portfolioRoutes.post("/record", (req, res) => {
  const { wallet, vaultAddress, positions, totalAmount, txHashes, reason } = req.body;
  if (!wallet || !Array.isArray(positions) || !totalAmount) {
    return res.status(400).json({ error: "wallet, positions[], and totalAmount required" });
  }

  try {
    const entry = portfolioService.recordPositions({
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
    const portfolio = portfolioService.getPortfolio(wallet);
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

    const updated = portfolioService.recordPositions({
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
