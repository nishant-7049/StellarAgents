import { Contract, nativeToScVal, TransactionBuilder, xdr, scValToNative, BASE_FEE, Account, Asset, Operation, Memo } from "@stellar/stellar-sdk";
import { Server, assembleTransaction } from "@stellar/stellar-sdk/rpc";
import { signTransaction } from "./freighter";
import {
  formatUsdc as sdkFormatUsdc,
  toStroops as sdkToStroops,
  USDC_DECIMALS,
  STROOPS_PER_USDC,
} from "@agenticocean/x402-stellar";

export const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";
export const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || "";
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const EXPLORER_URL = "https://stellar.expert/explorer/testnet";

function requireNetworkPassphrase(): string {
  if (!NETWORK_PASSPHRASE) {
    throw new Error("Missing NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE");
  }
  return NETWORK_PASSPHRASE;
}

// Re-export from SDK for backward compatibility
export { USDC_DECIMALS, STROOPS_PER_USDC };

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
  return sdkFormatUsdc(stroops);
}

export function toStroops(usdc: number): bigint {
  return sdkToStroops(usdc);
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
  // Use backend as proxy to build transaction (avoids browser bundling issues)
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

  const response = await fetch(`${BACKEND_URL}/api/tx/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contractId: params.contractId,
      method: params.method,
      args: params.args.map(arg => arg.toXDR("base64")),
      publicKey: params.publicKey,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    const detail = error.detail ? `: ${error.detail}` : "";
    throw new Error(`${error.error || "Transaction build failed"}${detail}`);
  }

  const { xdr: assembledXdr } = await response.json();
  return assembledXdr;
}

/**
 * Sign assembled XDR via Freighter, submit to network, poll for confirmation.
 * Returns the transaction hash.
 */
export async function signAndSubmit(assembledXdr: string): Promise<string> {
  // Freighter signs and returns the signed XDR
  const signedXdr = await signTransaction(assembledXdr);

  // Reconstruct the signed transaction
  const signedTx = TransactionBuilder.fromXDR(signedXdr, requireNetworkPassphrase());

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
    networkPassphrase: requireNetworkPassphrase(),
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

/**
 * Build a classic Stellar payment transaction (XLM or USDC).
 * Returns the unsigned transaction XDR string ready for Freighter signing.
 */
export async function buildPaymentTx(params: {
  from: string;
  to: string;
  asset: { code: string; issuer: string } | "native";
  amount: string; // decimal string, e.g. "5.0000000"
  memo?: string;
}): Promise<string> {
  const acctResp = await fetch(`${HORIZON_URL}/accounts/${params.from}`);
  if (!acctResp.ok) {
    throw new Error("Wallet account not found on Stellar — fund it with XLM first");
  }
  const acctData = await acctResp.json();
  const account = new Account(params.from, acctData.sequence);

  const stellarAsset =
    params.asset === "native"
      ? Asset.native()
      : new Asset(params.asset.code, params.asset.issuer);

  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: requireNetworkPassphrase(),
  }).addOperation(
    Operation.payment({
      destination: params.to,
      asset: stellarAsset,
      amount: params.amount,
    })
  );

  if (params.memo) {
    builder.addMemo(Memo.text(params.memo.slice(0, 28)));
  }

  return builder.setTimeout(60).build().toXDR();
}

/**
 * Submit a signed classic Stellar transaction XDR to Horizon.
 * Returns the transaction hash on success.
 */
export async function submitPaymentTx(signedXdr: string): Promise<string> {
  const resp = await fetch(`${HORIZON_URL}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `tx=${encodeURIComponent(signedXdr)}`,
  });
  const data = await resp.json();
  if (!resp.ok) {
    const code =
      data.extras?.result_codes?.transaction ||
      data.extras?.result_codes?.operations?.[0] ||
      "tx_failed";
    throw new Error(`Transaction failed: ${code}`);
  }
  return data.hash;
}
