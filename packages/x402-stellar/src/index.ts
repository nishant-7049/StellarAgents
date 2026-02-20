// ── Types ──
export type {
  PaymentRequirements,
  PaymentAccept,
  PaymentPayload,
  PaymentResponse,
  SettlementResult,
  X402RouteConfig,
  LoggerLike,
} from "./types.js";
export { ErrorCode, AgentNetError } from "./types.js";

// ── Config ──
export {
  STELLAR_CONFIG,
  TESTNET,
  MAINNET,
  USDC_DECIMALS,
  STROOPS_PER_USDC,
  formatUsdc,
  toStroops,
} from "./config.js";
export type { StellarNetworkConfig, StellarNetwork } from "./config.js";

// ── Header Builder ──
export { buildX402Header } from "./header-builder.js";

// ── Facilitator ──
export { settlePayment } from "./facilitator.js";
export type { SettlementOptions } from "./facilitator.js";

// ── Middleware ──
export { createX402Middleware } from "./middleware.js";
export type { X402MiddlewareOptions } from "./middleware.js";

// ── Stellar Transaction Helpers ──
export { buildAndSubmitTx, fundAccount } from "./stellar-tx.js";

// ── Stellar Client ──
export { createRpcClient, getAccount, getLatestLedger, generateKeypair } from "./stellar-client.js";
