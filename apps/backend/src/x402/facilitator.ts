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
    expirationLedger: number;
  };
}

interface SettlementResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export async function settlePayment(payload: PaymentPayload): Promise<SettlementResult> {
  const { payload: p } = payload;

  if (!config.FACILITATOR_SECRET_KEY) {
    return { success: false, error: "Facilitator key not configured" };
  }

  try {
    const facilitator = Keypair.fromSecret(config.FACILITATOR_SECRET_KEY);
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

    const assembled = assembleTransaction(tx, sim).build();
    assembled.sign(facilitator);

    const result = await rpc.sendTransaction(assembled);
    if (result.status !== "PENDING") {
      return { success: false, error: `send: ${result.status}` };
    }

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
    return { success: false, error: `tx: ${txResult.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
