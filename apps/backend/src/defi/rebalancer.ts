import cron from "node-cron";
import { blendClient } from "./blend-client.js";
import { config } from "../config.js";
import { logger } from "../logger.js";

interface AllocationTarget {
  protocol: string;
  asset: string;
  targetPct: number;
  currentPct: number;
}

let lastStrategy: AllocationTarget[] = [];
let rebalanceCount = 0;

export function setTargetAllocation(targets: AllocationTarget[]) {
  lastStrategy = targets;
  logger.info("Target allocation updated", { targets });
}

async function checkAndRebalance() {
  if (lastStrategy.length === 0) {
    logger.debug("No target strategy set, skipping rebalance check");
    return;
  }
  try {
    const blendData = await blendClient.loadPool();
    const driftThreshold = parseFloat(config.REBALANCE_DRIFT_THRESHOLD_PCT);
    for (const target of lastStrategy) {
      const drift = Math.abs(target.currentPct - target.targetPct);
      if (drift > driftThreshold) {
        logger.info(`Drift detected: ${drift.toFixed(1)}% > ${driftThreshold}%`, { target });
      }
    }
    rebalanceCount++;
    logger.debug("Rebalance check complete", { count: rebalanceCount });
  } catch (err) {
    logger.error("Rebalance check failed", { error: err });
  }
}

export function startRebalancer() {
  const interval = config.REBALANCE_INTERVAL_MINUTES;
  logger.info(`Starting rebalancer (every ${interval} min)`);
  cron.schedule(`*/${interval} * * * *`, async () => {
    logger.debug("Rebalancer tick");
    await checkAndRebalance();
  });
}

export function getRebalancerStatus() {
  return {
    running: true,
    intervalMinutes: parseInt(config.REBALANCE_INTERVAL_MINUTES),
    rebalanceCount,
    lastStrategy,
    driftThreshold: parseFloat(config.REBALANCE_DRIFT_THRESHOLD_PCT),
  };
}
