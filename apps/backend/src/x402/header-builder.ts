import { Keypair, Networks, TransactionBuilder, Contract, nativeToScVal } from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";
import { config } from "../config.js";

export async function buildX402Header(params: {
  vaultContract: string;
  agentSigner: string;
  agentSecret: string;
  payTo: string;
  amount: string;
  memo: string;
  agentId: number;
}): Promise<string> {
  const rpc = new Server(config.STELLAR_RPC_URL);
  const agentKp = Keypair.fromSecret(params.agentSecret);
  const vault = new Contract(params.vaultContract);

  const account = await rpc.getAccount(agentKp.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      vault.call(
        "agent_pay",
        nativeToScVal(params.agentSigner, { type: "address" }),
        nativeToScVal(params.payTo, { type: "address" }),
        nativeToScVal(BigInt(params.amount), { type: "i128" }),
        nativeToScVal(params.memo, { type: "symbol" }),
      )
    )
    .setTimeout(60)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (!("result" in sim)) throw new Error("Simulation failed for x402 header");

  const authEntries = sim.result?.auth || [];
  const signedAuthEntry = authEntries.length > 0 ? authEntries[0].toXDR("base64") : "";

  const payload = {
    x402Version: 1,
    scheme: "stellar-vault",
    network: "stellar:testnet",
    payload: {
      vaultContract: params.vaultContract,
      agentId: params.agentId,
      agentSigner: params.agentSigner,
      payTo: params.payTo,
      amount: params.amount,
      asset: config.USDC_SAC_ADDRESS,
      memo: params.memo,
      signedAuthEntry,
      expirationLedger: 0,
    },
  };

  return Buffer.from(JSON.stringify(payload)).toString("base64");
}
