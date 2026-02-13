import type { BlendClient } from "./blend-client.js";
import type { AllocationTarget, LoggerLike } from "./types.js";

export interface RebalancerOptions {
  driftThresholdPct: number;
  adminSecret?: string;
}

/**
 * Rebalancing engine (no cron — apps schedule their own calls).
 *
 * Usage:
 * ```ts
 * const rebalancer = new Rebalancer(blendClient, { driftThresholdPct: 5 });
 * rebalancer.setTargetAllocation(targets);
 * // On your own schedule:
 * await rebalancer.checkAndRebalance();
 * ```
 */
export class Rebalancer {
  private blendClient: BlendClient;
  private options: RebalancerOptions;
  private log: LoggerLike;
  private lastStrategy: AllocationTarget[] = [];
  private rebalanceCount = 0;

  constructor(blendClient: BlendClient, options: RebalancerOptions, logger?: LoggerLike) {
    this.blendClient = blendClient;
    this.options = options;
    this.log = logger ?? console;
  }

  /** Set the target allocation (typically called after AI generates a strategy). */
  setTargetAllocation(targets: AllocationTarget[]) {
    this.lastStrategy = targets;
    this.log.info("Target allocation updated", { targets });
  }

  /** Get the current target allocation. */
  getTargetAllocation(): AllocationTarget[] {
    return this.lastStrategy;
  }

  /** Get the number of rebalance cycles completed. */
  getRebalanceCount(): number {
    return this.rebalanceCount;
  }

  /** Check if rebalancing is needed and execute if so. */
  async checkAndRebalance(): Promise<void> {
    if (this.lastStrategy.length === 0) {
      this.log.debug("No target strategy set, skipping rebalance check");
      return;
    }

    try {
      const blendData = await this.blendClient.loadPool();
      const driftThreshold = this.options.driftThresholdPct;

      for (const target of this.lastStrategy) {
        const drift = Math.abs(target.currentPct - target.targetPct);
        if (drift > driftThreshold) {
          this.log.info(`Drift detected: ${drift.toFixed(1)}% > ${driftThreshold}%`, { target });

          if (target.protocol === "blend" && this.options.adminSecret) {
            const delta = target.targetPct - target.currentPct;
            if (delta > 0) {
              try {
                await this.blendClient.executeSupply({
                  poolId: blendData.poolId,
                  signerSecret: this.options.adminSecret,
                  asset: target.asset,
                  amount: BigInt(Math.abs(delta) * 100_0000000),
                });
                this.log.info("Rebalance supply executed", { target });
              } catch (err) {
                this.log.error("Rebalance supply failed", { target, error: err });
              }
            }
          }
        }
      }

      this.rebalanceCount++;
      this.log.debug("Rebalance check complete", { count: this.rebalanceCount });
    } catch (err) {
      this.log.error("Rebalance check failed", { error: err });
    }
  }
}
