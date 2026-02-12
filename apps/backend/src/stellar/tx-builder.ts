import { Keypair, Networks, TransactionBuilder, Contract } from "@stellar/stellar-sdk";
import { Server, assembleTransaction } from "@stellar/stellar-sdk/rpc";
import { config } from "../config.js";

const rpc = new Server(config.STELLAR_RPC_URL);

export async function invokeContract(params: {
  contractId: string;
  method: string;
  args: any[];
  signerSecret: string;
}): Promise<{ txHash: string }> {
  const keypair = Keypair.fromSecret(params.signerSecret);
  const account = await rpc.getAccount(keypair.publicKey());
  const contract = new Contract(params.contractId);

  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(contract.call(params.method, ...params.args))
    .setTimeout(60)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (!("result" in sim)) throw new Error("Simulation failed");

  const assembled = assembleTransaction(tx, sim).build();
  assembled.sign(keypair);

  const sendResult = await rpc.sendTransaction(assembled);
  if (sendResult.status !== "PENDING") throw new Error(`Send: ${sendResult.status}`);

  let txResult = await rpc.getTransaction(sendResult.hash);
  let waited = 0;
  while (txResult.status === "NOT_FOUND" && waited < 30) {
    await new Promise(r => setTimeout(r, 1000));
    txResult = await rpc.getTransaction(sendResult.hash);
    waited++;
  }
  if (txResult.status !== "SUCCESS") throw new Error(`Tx: ${txResult.status}`);
  return { txHash: sendResult.hash };
}
