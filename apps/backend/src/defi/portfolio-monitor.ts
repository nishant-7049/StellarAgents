/**
 * Portfolio Health Monitor
 *
 * Runs every 5 minutes. For each Blend pool being tracked:
 *   1. Fetch TVL (sum of reserve totalSupplyUnderlying)
 *   2. Save ApySnapshot to MongoDB
 *   3. Compare to previous snapshot
 *   4. If TVL drops ≥ EMERGENCY_TVL_DROP_USDC → record emergency event for affected wallets
 *
 * Emergency behaviour:
 *   - Marks affected positions as idle USDC in MongoDB (state tracking only)
 *   - Records an "emergency" RebalanceEvent so the frontend can surface it
 *   - Guards against re-triggering within 2 hours per protocol
 *
 * WHY no on-chain execution during emergencies:
 *   vault.agent_pay(poolId, amount) sends USDC FROM the vault TO the pool — that's the
 *   supply direction. Calling it during a TVL crash would make things worse, not better.
 *   A real on-chain withdrawal from Blend requires the vault contract to call
 *   blend_pool.submit(WithdrawCollateral) via a cross-contract invocation — this needs
 *   the vault owner's direct authorization and is not safe to fire autonomously here.
 *   The correct action is to alert (log + record state) and let the operator/user decide.
 */
import cron from "node-cron";
import { blendClient } from "./blend-client.js";
import { portfolioService } from "../services/portfolio.service.js";
import { ApySnapshot } from "../db/apy-snapshot.model.js";
import { PortfolioModel } from "../db/portfolio.model.js";
import { config } from "../config.js";
import { logger } from "../logger.js";

const EMERGENCY_TVL_DROP_USDC = parseFloat(config.EMERGENCY_TVL_DROP_USDC || "500000");
const MONITOR_INTERVAL = config.REBALANCE_INTERVAL_MINUTES || "5";

// In-memory guard: protocol → last emergency timestamp (ms)
const lastEmergencyAt: Record<string, number> = {};
const EMERGENCY_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours

let isRunning = false;

async function recordEmergencyState(protocol: string, drop: number) {
  // Find all wallets with positions in the affected protocol
  const affectedDocs = await PortfolioModel.find({
    "positions.protocolKey": protocol.toLowerCase(),
  }).lean();

  if (affectedDocs.length === 0) {
    logger.info(`No tracked wallets affected by ${protocol} TVL drop`);
    return;
  }

  logger.warn(`Emergency: marking ${affectedDocs.length} wallet(s) idle for ${protocol}`);

  for (const doc of affectedDocs) {
    try {
      const affectedPositions = doc.positions.filter(
        p => p.protocolKey === protocol.toLowerCase()
      );
      if (affectedPositions.length === 0) continue;

      const totalAffectedUsdc = affectedPositions.reduce((s, p) => s + (p.amountUsdc ?? 0), 0);

      // Move affected positions to idle — operator must execute on-chain withdrawal manually
      const remainingPositions = doc.positions.filter(
        p => p.protocolKey !== protocol.toLowerCase()
      );
      const idlePosition = {
        protocol: "Idle USDC (Emergency)",
        protocolKey: "idle",
        amountUsdc: totalAffectedUsdc,
        allocationPct: remainingPositions.length === 0 ? 100 : Math.round(
          (totalAffectedUsdc / (doc.totalInvested ?? totalAffectedUsdc)) * 100
        ),
        entryApy: 0,
        deployedAt: new Date().toISOString(),
      };

      await portfolioService.recordPositions({
        wallet: doc.wallet,
        vaultAddress: doc.vaultAddress,
        positions: [...remainingPositions, idlePosition],
        totalAmount: doc.totalInvested ?? totalAffectedUsdc,
        txHashes: [],  // no on-chain tx — state update only
        reason: `EMERGENCY: ${protocol} TVL dropped $${Math.round(drop).toLocaleString()} USDC — manual on-chain withdrawal required`,
      });

      logger.warn(
        `Emergency state recorded for ${doc.wallet.slice(0, 8)}… ` +
        `— $${totalAffectedUsdc.toFixed(2)} USDC in ${protocol} marked idle. ` +
        `Operator must withdraw from Blend on-chain.`
      );
    } catch (err) {
      logger.error(`Failed to record emergency state for ${doc.wallet.slice(0, 8)}…`, { err });
    }
  }
}

async function triggerEmergency(protocol: string, currentTvlUsdc: number, previousTvlUsdc: number) {
  const drop = previousTvlUsdc - currentTvlUsdc;
  logger.warn(
    `⚠ EMERGENCY: ${protocol} TVL dropped $${Math.round(drop).toLocaleString()} USDC ` +
    `($${Math.round(previousTvlUsdc).toLocaleString()} → $${Math.round(currentTvlUsdc).toLocaleString()})`
  );

  // Check cooldown — don't re-trigger on noisy data
  const lastTs = lastEmergencyAt[protocol] ?? 0;
  if (Date.now() - lastTs < EMERGENCY_COOLDOWN_MS) {
    logger.warn(`Emergency cooldown active for ${protocol} (${Math.round((Date.now() - lastTs) / 60_000)} min elapsed, need ${EMERGENCY_COOLDOWN_MS / 60_000} min)`);
    return;
  }
  lastEmergencyAt[protocol] = Date.now();

  await recordEmergencyState(protocol, drop);
}

async function runHealthCheck() {
  if (isRunning) return;
  isRunning = true;

  try {
    // 1. Fetch Blend pool data
    const blendData = await blendClient.loadPool();
    const poolId = blendData.poolId;

    // 2. Calculate TVL: sum reserve.totalSupply (stroops, 7 decimals) → USDC
    const reserves = blendData.reserves.map(r => ({
      symbol: r.symbol,
      totalSupplyUsdc: parseFloat(r.totalSupply) / 10_000_000,
      supplyApy: r.supplyApy,
    }));
    const tvlUsdc = reserves.reduce((s, r) => s + r.totalSupplyUsdc, 0);
    const primaryApy = reserves[0]?.supplyApy ?? 0;

    // 3. Save ApySnapshot to MongoDB
    await ApySnapshot.create({
      protocol: "blend",
      poolId,
      apy: primaryApy,
      tvlUsdc,
      reserves,
      timestamp: new Date(),
    });

    logger.debug(`Portfolio monitor: Blend TVL $${Math.round(tvlUsdc).toLocaleString()} USDC, APY ${primaryApy.toFixed(2)}%`);

    // 4. Fetch previous snapshot (second-most-recent = 5 min ago)
    const prevSnapshot = await ApySnapshot.findOne({ protocol: "blend" })
      .sort({ timestamp: -1 })
      .skip(1)
      .lean();

    if (!prevSnapshot) {
      // First run — no baseline yet
      isRunning = false;
      return;
    }

    // 5. Check for TVL drop
    const tvlDrop = prevSnapshot.tvlUsdc - tvlUsdc;
    if (tvlDrop >= EMERGENCY_TVL_DROP_USDC) {
      await triggerEmergency("blend", tvlUsdc, prevSnapshot.tvlUsdc);
    }

  } catch (err) {
    logger.error("Portfolio health monitor error", { err });
  } finally {
    isRunning = false;
  }
}

export function startPortfolioMonitor() {
  logger.info(
    `Portfolio health monitor started — every ${MONITOR_INTERVAL} min, ` +
    `emergency threshold: $${EMERGENCY_TVL_DROP_USDC.toLocaleString()} USDC TVL drop`
  );

  cron.schedule(`*/${MONITOR_INTERVAL} * * * *`, () => {
    runHealthCheck().catch(err => logger.error("Portfolio monitor tick failed", { err }));
  });
}
