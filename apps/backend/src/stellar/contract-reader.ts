import { Contract, scValToNative, TransactionBuilder } from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";
import { config } from "../config.js";
import { logger } from "../logger.js";

const rpc = new Server(config.STELLAR_RPC_URL);

export async function readContractValue(contractId: string, method: string, args: any[] = []): Promise<any> {
  try {
    const contract = new Contract(contractId);
    const account = await rpc.getAccount("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const result = await rpc.simulateTransaction(tx);
    if ("result" in result && result.result?.retval) {
      return scValToNative(result.result.retval);
    }
    return null;
  } catch (err) {
    logger.error("Contract read failed", { contractId, method, error: err });
    return null;
  }
}

export async function getVaultBalance(vaultAddress: string): Promise<string> {
  const balance = await readContractValue(vaultAddress, "balance");
  return balance?.toString() || "0";
}

export async function getAgentCount(registryAddress: string): Promise<number> {
  const count = await readContractValue(registryAddress, "agent_count");
  return count || 0;
}
