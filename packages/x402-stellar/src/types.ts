// ── x402 Protocol Types ──

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
    assembledTxXdr?: string;
    expirationLedger: number;
  };
}

export interface PaymentResponse {
  txHash: string;
  network: string;
}

export interface SettlementResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

// ── Middleware Types ──

export interface X402RouteConfig {
  price: string;
  description: string;
}

// ── Error Types ──

export enum ErrorCode {
  WALLET_NOT_CONNECTED = "WALLET_NOT_CONNECTED",
  VAULT_NOT_FOUND = "VAULT_NOT_FOUND",
  AGENT_NOT_FOUND = "AGENT_NOT_FOUND",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  TX_FAILED = "TX_FAILED",
  X402_PAYMENT_REQUIRED = "X402_PAYMENT_REQUIRED",
  X402_SETTLEMENT_FAILED = "X402_SETTLEMENT_FAILED",
  SIMULATION_FAILED = "SIMULATION_FAILED",
  REPUTATION_NOT_FOUND = "REPUTATION_NOT_FOUND",
  INVALID_SCORE = "INVALID_SCORE",
  VALIDATION_NOT_FOUND = "VALIDATION_NOT_FOUND",
  VALIDATION_ALREADY_COMPLETED = "VALIDATION_ALREADY_COMPLETED",
  NOT_VALIDATOR = "NOT_VALIDATOR",
}

export class AgentNetError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AgentNetError";
  }
}

// ── Utility Types ──

export interface LoggerLike {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}
