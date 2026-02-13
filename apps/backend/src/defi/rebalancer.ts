import cron from "node-cron";
import { Rebalancer } from "@stellaragent402/agent-ai";
import type { AllocationTarget } from "@stellaragent402/agent-ai";
import { blendClient } from "./blend-client.js";
import { config } from "../config.js";
import { logger } from "../logger.js";

const rebalancer = new Rebalancer(
  blendClient,
  {
    driftThresholdPct: parseFloat(config.REBALANCE_DRIFT_THRESHOLD_PCT),
    adminSecret: config.ADMIN_SECRET_KEY || undefined,
  },
  logger,
);

export function setTargetAllocation(targets: AllocationTarget[]) {
  rebalancer.setTargetAllocation(targets);
}

export function startRebalancer() {
  const interval = config.REBALANCE_INTERVAL_MINUTES;
  logger.info(`Starting rebalancer (every ${interval} min)`);
  cron.schedule(`*/${interval} * * * *`, async () => {
    logger.debug("Rebalancer tick");
    await rebalancer.checkAndRebalance();
  });
}

export function getRebalancerStatus() {
  return {
    running: true,
    intervalMinutes: parseInt(config.REBALANCE_INTERVAL_MINUTES),
    rebalanceCount: rebalancer.getRebalanceCount(),
    lastStrategy: rebalancer.getTargetAllocation(),
    driftThreshold: parseFloat(config.REBALANCE_DRIFT_THRESHOLD_PCT),
  };
}
