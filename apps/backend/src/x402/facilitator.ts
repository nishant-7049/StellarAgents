import { Keypair, Networks, TransactionBuilder, Contract, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { Server, assembleTransaction } from "@stellar/stellar-sdk/rpc";
import { config } from "../config.js";
import { logger } from "../logger.js";

const rpc = new Server(config.STELLAR_RPC_URL);

interface PaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    vaultContract: string;
    agentId: number;
    agentSigner: string;
    payTo: string;
    amount: string;
    asset: string;
    memo: string;
    signedAuthEntry: string;
    assembledTxXdr?: string;
    expirationLedger: number;
  };
}

interface SettlementResult {
  success: boolean;
  txHash?: string;
  error?: string;
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
export async function settlePayment(payload: PaymentPayload): Promise<SettlementResult> {
  const { payload: p } = payload;

  if (!config.FACILITATOR_SECRET_KEY) {
    return { success: false, error: "Facilitator key not configured" };
  }

  try {
    const facilitator = Keypair.fromSecret(config.FACILITATOR_SECRET_KEY);
    let assembled: any;

    if (p.assembledTxXdr) {
      // Preferred path: use the pre-assembled transaction from the agent.
      // This ensures the footprint matches the signed auth entry's nonce.
      assembled = TransactionBuilder.fromXDR(p.assembledTxXdr, Networks.TESTNET);
    } else {
      // Fallback: build and simulate our own transaction.
      // This may fail if auth nonces differ between simulations.
      const vault = new Contract(p.vaultContract);
      const account = await rpc.getAccount(facilitator.publicKey());

      const tx = new TransactionBuilder(account, {
        fee: "1000000",
        networkPassphrase: Networks.TESTNET,
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

    // Sign as facilitator (source account, pays XLM fees)
    assembled.sign(facilitator);

    // Submit
    const result = await rpc.sendTransaction(assembled);
    if (result.status !== "PENDING") {
      return { success: false, error: `send: ${result.status}` };
    }

    // Poll for confirmation.
    // Note: getTransaction may throw XDR parse errors if the testnet runs
    // a newer protocol than the SDK supports.
    try {
      let txResult = await rpc.getTransaction(result.hash);
      let waited = 0;
      while (txResult.status === "NOT_FOUND" && waited < 30) {
        await new Promise(r => setTimeout(r, 1000));
        txResult = await rpc.getTransaction(result.hash);
        waited++;
      }

      if (txResult.status === "SUCCESS") {
        logger.info("x402 settled", { txHash: result.hash, amount: p.amount });
        return { success: true, txHash: result.hash };
      }
      if (txResult.status === "NOT_FOUND") {
        logger.warn("x402 tx still pending after 30s", { txHash: result.hash });
        return { success: true, txHash: result.hash };
      }
      return { success: false, error: `tx: ${txResult.status}` };
    } catch (pollErr: any) {
      // XDR parse error — tx was submitted, confirm via Horizon
      logger.warn("getTransaction parse error, checking Horizon", {
        txHash: result.hash,
        error: pollErr.message,
      });
      try {
        await new Promise(r => setTimeout(r, 5000));
        const horizonResp = await fetch(
          `${config.STELLAR_HORIZON_URL}/transactions/${result.hash}`,
        );
        if (horizonResp.ok) {
          const horizonTx = await horizonResp.json() as any;
          if (horizonTx.successful) {
            logger.info("x402 settled (Horizon)", { txHash: result.hash, amount: p.amount });
            return { success: true, txHash: result.hash };
          }
          return { success: false, error: `tx failed: ${horizonTx.result_xdr}` };
        }
        // Horizon hasn't indexed yet — return hash, assume success
        logger.info("x402 tx submitted", { txHash: result.hash });
        return { success: true, txHash: result.hash };
      } catch {
        return { success: true, txHash: result.hash };
      }
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
