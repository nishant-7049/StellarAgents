import type { BlendClient } from "./blend-client.js";
import type { SoroswapClient } from "./soroswap-client.js";
import type { AllocationTarget, PortfolioSnapshot, LoggerLike } from "./types.js";

export interface RebalancerOptions {
  driftThresholdPct: number;
  /**
   * Agent signer secret key — authorized on the user's vault.
   * Replaces the old adminSecret. No owner/admin key needed.
   */
  agentSignerSecret?: string;
  /**
   * The UserVault contract address funds flow from.
   */
  vaultContract?: string;
  /**
   * x402 facilitator URL for submitting vault.agent_pay() calls.
   */
  facilitatorUrl?: string;
}

/**
 * Rebalancing engine (no cron — apps schedule their own calls).
 *
 * All fund movements go through the UserVault via agent_pay():
 *   agent signs → facilitator submits → vault enforces limits on-chain
 *
 * No admin or owner key is ever needed.
 *
 * Usage:
 * ```ts
 * const rebalancer = new Rebalancer(blendClient, soroswapClient, {
 *   driftThresholdPct: 5,
 *   agentSignerSecret: process.env.AGENT_SIGNER_SECRET_KEY,
 *   vaultContract: "C...",
 *   facilitatorUrl: "http://localhost:3001",
 * });
 * rebalancer.setTargetAllocation(targets);
 * await rebalancer.checkAndRebalance();
 * ```
 */
export class Rebalancer {
  private blendClient: BlendClient;
  private soroswapClient: SoroswapClient;
  private options: RebalancerOptions;
  private log: LoggerLike;
  private lastStrategy: AllocationTarget[] = [];
  private rebalanceCount = 0;

  constructor(
    blendClient: BlendClient,
    soroswapClient: SoroswapClient,
    options: RebalancerOptions,
    logger?: LoggerLike,
  ) {
    this.blendClient = blendClient;
    this.soroswapClient = soroswapClient;
    this.options = options;
    this.log = logger ?? console;
  }

  /** Set the target allocation (called after AI generates a strategy). */
  setTargetAllocation(targets: AllocationTarget[]) {
    this.lastStrategy = targets;
    this.log.info("Target allocation updated", { targets });
  }

  getTargetAllocation(): AllocationTarget[] {
    return this.lastStrategy;
  }

  getRebalanceCount(): number {
    return this.rebalanceCount;
  }

  /**
   * Read current on-chain portfolio positions from Blend and Soroswap.
   * Returns a snapshot with per-protocol USDC values and percentages.
   */
  async readCurrentPortfolio(vaultAddress: string): Promise<PortfolioSnapshot> {
    const [blendPos, soroPos] = await Promise.all([
      this.blendClient.loadUserPosition(vaultAddress),
      this.soroswapClient.loadLPPosition(vaultAddress),
    ]);

    const blendUSDC = blendPos.estimatedSupplyValue - blendPos.estimatedBorrowValue;
    const soroUSDC = soroPos.valueUSDC;
    const totalUSDC = blendUSDC + soroUSDC;

    const positions: PortfolioSnapshot["positions"] = [
      {
        protocol: "blend",
        poolId: blendPos.poolId,
        usdcValue: blendUSDC,
        pct: totalUSDC > 0 ? (blendUSDC / totalUSDC) * 100 : 0,
      },
      {
        protocol: "soroswap",
        poolId: soroPos.pairAddress,
        usdcValue: soroUSDC,
        pct: totalUSDC > 0 ? (soroUSDC / totalUSDC) * 100 : 0,
      },
    ];

    this.log.info("Current portfolio snapshot", { vaultAddress, totalUSDC, positions });
    return { totalUSDC, positions };
  }

  /** Check if rebalancing is needed and execute if so. */
  async checkAndRebalance(): Promise<void> {
    if (this.lastStrategy.length === 0) {
      this.log.debug("No target strategy set, skipping rebalance check");
      return;
    }

    const { agentSignerSecret, vaultContract, facilitatorUrl } = this.options;

    if (!agentSignerSecret || !vaultContract) {
      this.log.warn(
        "Rebalancer: agentSignerSecret and vaultContract are required for execution. " +
        "Set them in RebalancerOptions to enable on-chain rebalancing."
      );
      return;
    }

    try {
      // 1. Read actual on-chain positions
      const snapshot = await this.readCurrentPortfolio(vaultContract);

      // 2. Update currentPct on each target from real snapshot
      const updatedStrategy = this.lastStrategy.map(target => {
        const pos = snapshot.positions.find(p => p.protocol === target.protocol);
        return { ...target, currentPct: pos?.pct ?? target.currentPct };
      });

      const blendData = await this.blendClient.loadPool();
      const driftThreshold = this.options.driftThresholdPct;
      const url = facilitatorUrl ?? "http://localhost:3001";

      // 3. Separate into withdraws (over-allocated) and supplies (under-allocated)
      const toWithdraw: Array<{ target: AllocationTarget; drift: number; delta: number }> = [];
      const toSupply: Array<{ target: AllocationTarget; drift: number; delta: number }> = [];

      for (const target of updatedStrategy) {
        const drift = Math.abs(target.currentPct - target.targetPct);
        if (drift <= driftThreshold) continue;

        const delta = target.targetPct - target.currentPct;
        this.log.info(`Drift detected: ${drift.toFixed(1)}% > ${driftThreshold}%`, { target, delta });

        if (delta < 0) {
          toWithdraw.push({ target, drift, delta });
        } else {
          toSupply.push({ target, drift, delta });
        }
      }

      if (toWithdraw.length === 0 && toSupply.length === 0) {
        this.log.debug("Portfolio within threshold, no rebalance needed");
        this.rebalanceCount++;
        return;
      }

      // 4. Execute ALL withdraws first
      for (const { target, delta } of toWithdraw) {
        if (target.protocol === "blend") {
          try {
            const result = await this.blendClient.executeViaVault({
              poolId: blendData.poolId,
              agentSignerSecret,
              vaultContract,
              asset: target.asset,
              amount: BigInt(Math.round(Math.abs(delta) * 100_0000000)),
              facilitatorUrl: url,
              memo: "rebalance_withdraw",
            });
            this.log.info("Rebalance withdraw executed via vault", { txHash: result.txHash, target });
          } catch (err) {
            this.log.error("Rebalance withdraw failed", { target, error: err });
          }
        }
      }

      // 5. Then execute ALL supplies
      for (const { target, delta } of toSupply) {
        if (target.protocol === "blend") {
          try {
            const result = await this.blendClient.executeViaVault({
              poolId: blendData.poolId,
              agentSignerSecret,
              vaultContract,
              asset: target.asset,
              amount: BigInt(Math.round(Math.abs(delta) * 100_0000000)),
              facilitatorUrl: url,
              memo: "rebalance_supply",
            });
            this.log.info("Rebalance supply executed via vault", { txHash: result.txHash, target });
          } catch (err) {
            this.log.error("Rebalance supply failed", { target, error: err });
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
