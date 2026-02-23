export interface PaymentRequirements {
  x402Version: number;
  accepts: {
    scheme: string;
    network: string;
    asset: string;
    amount: string;
    payTo: string;
    maxTimeoutSeconds: number;
    description: string;
  }[];
}

export interface X402PaymentResult {
  txHash: string;
  network: string;
  amount: string;
  payer: string;
}

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
  strategies: YieldStrategy[];
  total_estimated_apy: number;
  summary: string;
  disclaimer: string;
  x402?: { txHash: string; payer: string; agentId: number };
}
