import { Networks } from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";

export const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";
export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const EXPLORER_URL = "https://stellar.expert/explorer/testnet";

export const rpc = new Server(RPC_URL);

export function getTxUrl(txHash: string): string {
  return `${EXPLORER_URL}/tx/${txHash}`;
}

export function getAccountUrl(address: string): string {
  return `${EXPLORER_URL}/account/${address}`;
}

export function formatUsdc(stroops: string | number): string {
  const amount = typeof stroops === "string" ? parseInt(stroops) : stroops;
  return (amount / 10_000_000).toFixed(2);
}

export function toStroops(usdc: number): string {
  return Math.round(usdc * 10_000_000).toString();
}
