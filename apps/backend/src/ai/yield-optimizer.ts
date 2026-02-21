import { YieldOptimizer as SdkYieldOptimizer, Rebalancer, BlendClient } from "@agenticocean/defi-agent";
import { blendClient } from "../defi/blend-client.js";
import { setTargetAllocation } from "../defi/rebalancer.js";
import { config } from "../config.js";
import { logger } from "../logger.js";

export type { StrategyResponse } from "@agenticocean/defi-agent";

// Create a Rebalancer-compatible wrapper that delegates to the app-level setTargetAllocation
const rebalancerProxy = {
  setTargetAllocation,
  getTargetAllocation: () => [],
  getRebalanceCount: () => 0,
  checkAndRebalance: async () => {},
} as any;

const optimizer = new SdkYieldOptimizer(
  {
    stellarRpcUrl: config.STELLAR_RPC_URL,
    networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
    anthropicApiKey: config.ANTHROPIC_API_KEY,
    soroswapApiKey: config.SOROSWAP_API_KEY,
    usdcAddress: config.USDC_SAC_ADDRESS,
    blendPoolId: config.BLEND_POOL_USDC,
    logger,
  },
);

export class YieldOptimizer {
  async optimize(query: string, riskTolerance: string = "moderate", amount?: number) {
    const result = await optimizer.optimize(query, riskTolerance, amount);

    // Forward targets to the app-level rebalancer
    if (result.strategies.length > 0) {
      setTargetAllocation(
        result.strategies.map(s => ({
          protocol: s.protocol.toLowerCase().includes("blend") ? "blend" : "soroswap",
          asset: config.USDC_SAC_ADDRESS,
          targetPct: s.allocation_pct,
          currentPct: 0,
        }))
      );
    }

    return result;
  }
}
