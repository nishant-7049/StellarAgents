// ── Types ──
export type {
  YieldStrategy,
  StrategyResponse,
  BlendPoolData,
  UserBlendPosition,
  SwapQuote,
  PoolData,
  AllocationTarget,
  PortfolioSnapshot,
  AgentAIConfig,
  LoggerLike,
} from "./types.js";

// ── Yield Optimizer ──
export { YieldOptimizer } from "./yield-optimizer.js";

// ── Prompts ──
export { SYSTEM_PROMPT, buildUserPrompt } from "./prompts.js";

// ── Blend Client ──
export { BlendClient } from "./blend-client.js";

// ── Soroswap Client ──
export { SoroswapClient } from "./soroswap-client.js";

// ── Rebalancer ──
export { Rebalancer } from "./rebalancer.js";
export type { RebalancerOptions } from "./rebalancer.js";
