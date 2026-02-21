import { settlePayment as sdkSettlePayment } from "@agentsea/x402-stellar";
import type { PaymentPayload, SettlementResult } from "@agentsea/x402-stellar";
import { config } from "../config.js";
import { logger } from "../logger.js";

export type { PaymentPayload, SettlementResult };

export async function settlePayment(payload: PaymentPayload): Promise<SettlementResult> {
  return sdkSettlePayment(payload, {
    rpcUrl: config.STELLAR_RPC_URL,
    horizonUrl: config.STELLAR_HORIZON_URL,
    networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
    facilitatorSecret: config.FACILITATOR_SECRET_KEY,
    logger,
  });
}
