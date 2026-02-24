import {
  buildAndSubmitTx as sdkBuildAndSubmitTx,
  fundAccount as sdkFundAccount,
} from "@agenticocean/x402-stellar";
import { config } from "../config.js";
import { logger } from "../logger.js";

export async function buildAndSubmitTx(params: {
  signerSecret: string;
  operations: any[];
}): Promise<{ txHash: string }> {
  return sdkBuildAndSubmitTx({
    rpcUrl: config.STELLAR_RPC_URL,
    networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
    logger,
    ...params,
  });
}

export async function fundAccount(publicKey: string): Promise<void> {
  return sdkFundAccount(publicKey, logger);
}
