export enum ErrorCode {
  WALLET_NOT_CONNECTED = "WALLET_NOT_CONNECTED",
  VAULT_NOT_FOUND = "VAULT_NOT_FOUND",
  AGENT_NOT_FOUND = "AGENT_NOT_FOUND",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  TX_FAILED = "TX_FAILED",
  X402_PAYMENT_REQUIRED = "X402_PAYMENT_REQUIRED",
  X402_SETTLEMENT_FAILED = "X402_SETTLEMENT_FAILED",
  SIMULATION_FAILED = "SIMULATION_FAILED",
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
