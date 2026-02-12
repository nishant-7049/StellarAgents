import { Keypair } from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";
import { config } from "../config.js";
import { logger } from "../logger.js";

const rpc = new Server(config.STELLAR_RPC_URL);

export async function getAccount(publicKey: string) {
  return rpc.getAccount(publicKey);
}

export async function getLatestLedger() {
  return rpc.getLatestLedger();
}

export async function fundWithFriendbot(publicKey: string) {
  const resp = await fetch(`https://friendbot.stellar.org/?addr=${publicKey}`);
  if (!resp.ok) throw new Error("Friendbot failed");
  logger.info("Funded account", { publicKey });
}

export function generateKeypair() {
  return Keypair.random();
}

export { rpc };
