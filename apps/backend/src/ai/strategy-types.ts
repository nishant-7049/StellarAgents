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
