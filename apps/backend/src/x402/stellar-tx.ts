import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import { Server, assembleTransaction } from "@stellar/stellar-sdk/rpc";
import { config } from "../config.js";
import { logger } from "../logger.js";

const rpc = new Server(config.STELLAR_RPC_URL);

export async function buildAndSubmitTx(params: {
  signerSecret: string;
  operations: any[];
}): Promise<{ txHash: string }> {
  const keypair = Keypair.fromSecret(params.signerSecret);
  const account = await rpc.getAccount(keypair.publicKey());

  const builder = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: Networks.TESTNET,
  });
  for (const op of params.operations) builder.addOperation(op);
  const tx = builder.setTimeout(60).build();

  const sim = await rpc.simulateTransaction(tx);
  if (!("result" in sim)) throw new Error("Simulation failed");

  const assembled = assembleTransaction(tx, sim).build();
  assembled.sign(keypair);

  const result = await rpc.sendTransaction(assembled);
  if (result.status !== "PENDING") throw new Error(`Send: ${result.status}`);

  let txResult = await rpc.getTransaction(result.hash);
  let waited = 0;
  while (txResult.status === "NOT_FOUND" && waited < 30) {
    await new Promise(r => setTimeout(r, 1000));
    txResult = await rpc.getTransaction(result.hash);
    waited++;
  }
  if (txResult.status !== "SUCCESS") throw new Error(`Tx: ${txResult.status}`);
  return { txHash: result.hash };
}

export async function fundAccount(publicKey: string): Promise<void> {
  const response = await fetch(`https://friendbot.stellar.org/?addr=${publicKey}`);
  if (!response.ok) throw new Error(`Friendbot failed: ${response.statusText}`);
  logger.info("Account funded via friendbot", { publicKey });
}
