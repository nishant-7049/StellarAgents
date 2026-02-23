import { Networks, Contract, nativeToScVal, TransactionBuilder, xdr, scValToNative } from "@stellar/stellar-sdk";
import { Server, assembleTransaction } from "@stellar/stellar-sdk/rpc";
import { signTransaction } from "./freighter";

export const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";
export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const EXPLORER_URL = "https://stellar.expert/explorer/testnet";

// Facilitator public key — funded account used as source for read-only simulations
const READ_SOURCE = "GB4WBZZRI3RWJI7IUBOMO4R7SILFN2IWNXRWTLIGM7E7ZF3YV6N5HNME";

export const rpc = new Server(RPC_URL);

export function getTxUrl(txHash: string): string {
  return `${EXPLORER_URL}/tx/${txHash}`;
}

export function getAccountUrl(address: string): string {
  return `${EXPLORER_URL}/account/${address}`;
}

export function formatUsdc(stroops: string | number | bigint): string {
  const amount = typeof stroops === "bigint"
    ? Number(stroops)
    : typeof stroops === "string"
      ? parseInt(stroops)
      : stroops;
  return (amount / 10_000_000).toFixed(2);
}

export function toStroops(usdc: number): bigint {
  return BigInt(Math.round(usdc * 10_000_000));
}

export type TxState = "idle" | "building" | "signing" | "submitting" | "confirming" | "success" | "error";

/**
 * Build + simulate a Soroban contract call. Returns assembled XDR string ready for Freighter.
 */
export async function buildContractTx(params: {
  contractId: string;
  method: string;
  args: xdr.ScVal[];
  publicKey: string;
}): Promise<string> {
  const contract = new Contract(params.contractId);
  const account = await rpc.getAccount(params.publicKey);

  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(params.method, ...params.args))
    .setTimeout(60)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (!("result" in sim)) {
    const errMsg = "transactionData" in sim
      ? JSON.stringify((sim as any).error)
      : "Simulation failed";
    throw new Error(errMsg);
  }

  const assembled = assembleTransaction(tx, sim).build();
  return assembled.toXDR();
}

/**
 * Sign assembled XDR via Freighter, submit to network, poll for confirmation.
 * Returns the transaction hash.
 */
export async function signAndSubmit(assembledXdr: string): Promise<string> {
  // Freighter signs and returns the signed XDR
  const signedXdr = await signTransaction(assembledXdr);

  // Reconstruct the signed transaction
  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  const result = await rpc.sendTransaction(signedTx);
  if (result.status !== "PENDING") {
    throw new Error(`Transaction send failed: ${result.status}`);
  }

  // Poll for confirmation (max 30s)
  const txHash = result.hash;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const txResult = await rpc.getTransaction(txHash);
      if (txResult.status === "SUCCESS") return txHash;
      if (txResult.status === "FAILED") throw new Error("Transaction failed on-chain");
    } catch (e: any) {
      // getTransaction may throw "Bad union switch" on newer protocol
      if (e.message?.includes("union switch") || e.message?.includes("Union")) {
        // Fallback to Horizon
        const horizonResp = await fetch(`${HORIZON_URL}/transactions/${txHash}`);
        if (horizonResp.ok) {
          const horizonTx = await horizonResp.json();
          if (horizonTx.successful) return txHash;
        }
        continue;
      }
      if (e.message?.includes("failed")) throw e;
    }
  }

  // If still pending after 30s, return hash anyway (tx was accepted)
  return txHash;
}

/**
 * Read-only contract call — simulate without signing. Uses facilitator as dummy source.
 * Returns the decoded result via scValToNative.
 */
export async function readContract<T = any>(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<T> {
  const contract = new Contract(contractId);
  const account = await rpc.getAccount(READ_SOURCE);

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (!("result" in sim)) {
    throw new Error("Read simulation failed");
  }

  const retval = sim.result?.retval;
  if (!retval) throw new Error("No return value from simulation");

  return scValToNative(retval) as T;
}

/**
 * Shorten a Stellar address for display: GABC...WXYZ
 */
export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
