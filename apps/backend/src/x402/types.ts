export interface PaymentRequirements {
  x402Version: number;
  accepts: PaymentAccept[];
}

export interface PaymentAccept {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  description: string;
}

export interface PaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    vaultContract: string;
    agentId: number;
    agentSigner: string;
    payTo: string;
    amount: string;
    asset: string;
    memo: string;
    signedAuthEntry: string;
    expirationLedger: number;
  };
}

export interface SettlementResult {
  success: boolean;
  txHash?: string;
  error?: string;
}
