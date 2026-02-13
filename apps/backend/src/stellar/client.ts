import {
  createRpcClient,
  getAccount as sdkGetAccount,
  getLatestLedger as sdkGetLatestLedger,
  generateKeypair as sdkGenerateKeypair,
  fundAccount,
} from "@stellaragent402/x402-stellar";
import { config } from "../config.js";
import { logger } from "../logger.js";

export const rpc = createRpcClient(config.STELLAR_RPC_URL);

export async function getAccount(publicKey: string) {
  return sdkGetAccount(rpc, publicKey);
}

export async function getLatestLedger() {
  return sdkGetLatestLedger(rpc);
}

export async function fundWithFriendbot(publicKey: string) {
  return fundAccount(publicKey, logger);
}

export function generateKeypair() {
  return sdkGenerateKeypair();
}
