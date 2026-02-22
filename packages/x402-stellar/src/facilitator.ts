import {
  Keypair, TransactionBuilder, Contract, nativeToScVal, xdr,
} from "@stellar/stellar-sdk";
import { Server, assembleTransaction } from "@stellar/stellar-sdk/rpc";
import type { PaymentPayload, SettlementResult, LoggerLike } from "./types.js";

export interface SettlementOptions {
  rpcUrl: string;
  horizonUrl: string;
  networkPassphrase: string;
  facilitatorSecret: string;
  logger?: LoggerLike;
}

/**
 * Settle an x402 payment by submitting the agent's pre-assembled transaction.
 *
 * Flow:
 * 1. If the header includes assembledTxXdr (recommended):
 *    - Deserialize the pre-assembled transaction
 *    - Sign as facilitator (pays XLM fees)
 *    - Submit directly
 *
 * 2. Fallback (legacy, no assembledTxXdr):
 *    - Build and simulate our own transaction
 *    - Inject the agent's signed auth entry
 *    - Assemble, sign, submit
 *    (May fail due to auth nonce/footprint mismatch)
 */
export async function settlePayment(
  payload: PaymentPayload,
  options: SettlementOptions,
): Promise<SettlementResult> {
  const { payload: p } = payload;
  const log = options.logger ?? console;
  const rpc = new Server(options.rpcUrl);

  if (!options.facilitatorSecret) {
    return { success: false, error: "Facilitator key not configured" };
  }

  try {
    const facilitator = Keypair.fromSecret(options.facilitatorSecret);
    let assembled: any;

    if (p.assembledTxXdr) {
      assembled = TransactionBuilder.fromXDR(p.assembledTxXdr, options.networkPassphrase);
    } else {
      const vault = new Contract(p.vaultContract);
      const account = await rpc.getAccount(facilitator.publicKey());

      const tx = new TransactionBuilder(account, {
        fee: "1000000",
        networkPassphrase: options.networkPassphrase,
      })
        .addOperation(
          vault.call(
            "agent_pay",
            nativeToScVal(p.agentSigner, { type: "address" }),
            nativeToScVal(p.payTo, { type: "address" }),
            nativeToScVal(BigInt(p.amount), { type: "i128" }),
            nativeToScVal(p.memo, { type: "symbol" }),
          )
        )
        .setTimeout(60)
        .build();

      const sim = await rpc.simulateTransaction(tx);
      if (!("result" in sim)) {
        return { success: false, error: "simulation failed" };
      }

      const signedAuth = xdr.SorobanAuthorizationEntry.fromXDR(p.signedAuthEntry, "base64");
      if (sim.result?.auth) {
        sim.result.auth = [signedAuth];
      }

      assembled = assembleTransaction(tx, sim).build();
    }

    assembled.sign(facilitator);

    const result = await rpc.sendTransaction(assembled);
    if (result.status !== "PENDING") {
      return { success: false, txHash: result.hash, error: `send: ${result.status}` };
    }

    try {
      let txResult = await rpc.getTransaction(result.hash);
      let waited = 0;
      while (txResult.status === "NOT_FOUND" && waited < 30) {
        await new Promise(r => setTimeout(r, 1000));
        txResult = await rpc.getTransaction(result.hash);
        waited++;
      }

      if (txResult.status === "SUCCESS") {
        log.info("x402 settled", { txHash: result.hash, amount: p.amount });
        return { success: true, txHash: result.hash };
      }
      if (txResult.status === "NOT_FOUND") {
        log.warn("x402 tx not confirmed after 30s", { txHash: result.hash });
        return { success: false, txHash: result.hash, error: "timeout: tx not confirmed after 30s" };
      }
      return { success: false, txHash: result.hash, error: `tx: ${txResult.status}` };
    } catch (pollErr: any) {
      log.warn("getTransaction parse error, checking Horizon", {
        txHash: result.hash,
        error: pollErr.message,
      });
      try {
        await new Promise(r => setTimeout(r, 5000));
        const horizonResp = await fetch(
          `${options.horizonUrl}/transactions/${result.hash}`,
        );
        if (horizonResp.ok) {
          const horizonTx = await horizonResp.json() as any;
          if (horizonTx.successful) {
            log.info("x402 settled (Horizon)", { txHash: result.hash, amount: p.amount });
            return { success: true, txHash: result.hash };
          }
          return { success: false, txHash: result.hash, error: `tx failed: ${horizonTx.result_xdr}` };
        }
        log.warn("x402 Horizon check inconclusive", { txHash: result.hash });
        return { success: false, txHash: result.hash, error: "horizon: tx status unknown" };
      } catch {
        return { success: false, txHash: result.hash, error: "horizon: fetch failed" };
      }
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
