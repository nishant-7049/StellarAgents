import { Keypair } from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";

/**
 * Create a Soroban RPC client.
 */
export function createRpcClient(rpcUrl: string): Server {
  return new Server(rpcUrl);
}

/**
 * Get account details from the RPC.
 */
export async function getAccount(rpc: Server, publicKey: string) {
  return rpc.getAccount(publicKey);
}

/**
 * Get the latest ledger sequence from the RPC.
 */
export async function getLatestLedger(rpc: Server) {
  return rpc.getLatestLedger();
}

/**
 * Generate a random Stellar keypair.
 */
export function generateKeypair(): Keypair {
  return Keypair.random();
}
