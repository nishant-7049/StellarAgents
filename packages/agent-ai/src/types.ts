// ── AI Strategy Types ──

export interface YieldStrategy {
  protocol: string;
  action: string;
  allocation_pct: number;
  estimated_apy: number;
  risk_level: "low" | "moderate" | "high";
  details: string;
}

export interface StrategyResponse {
  query: string;
  risk_tolerance: string;
  amount_usdc?: number;
  strategies: YieldStrategy[];
  total_estimated_apy: number;
  summary: string;
  data_sources: {
    blend_pools: number;
    soroswap_pools: number;
    rwa_sources: number;
  };
  disclaimer: string;
  x402?: {
    txHash: string;
    payer: string;
    agentId: number;
  };
}

// ── Blend Types ──

export interface BlendPoolData {
  poolId: string;
  poolName: string;
  reserves: Array<{
    assetId: string;
    symbol: string;
    supplyApy: number;
    borrowApy: number;
    totalSupply: string;
    totalBorrow: string;
    utilization: number;
  }>;
  emissions: { blndPerDay: number; estimatedBlndApy: number };
}

export interface UserBlendPosition {
  poolId: string;
  estimatedSupplyValue: number;
  estimatedBorrowValue: number;
  netApr: number;
}

// ── Soroswap Types ──

export interface SwapQuote {
  amountIn: string;
  amountOut: string;
  priceImpact: number;
  route: string[];
  protocol: string;
}

export interface PoolData {
  pairAddress: string;
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
  apy: number;
}

// ── Rebalancer Types ──

export interface AllocationTarget {
  protocol: string;
  asset: string;
  targetPct: number;
  currentPct: number;
}

// ── Config ──

export interface AgentAIConfig {
  stellarRpcUrl: string;
  networkPassphrase: string;
  anthropicApiKey?: string;
  soroswapApiKey?: string;
  usdcAddress?: string;
  blendPoolId?: string;
  logger?: LoggerLike;
}

// ── Logger ──

export interface LoggerLike {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}
