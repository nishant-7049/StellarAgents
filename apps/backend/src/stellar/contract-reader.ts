import { ContractReader } from "@agentsea/vault";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { Keypair, nativeToScVal } from "@stellar/stellar-sdk";

function getSimulationSource(): string {
  if (config.FACILITATOR_SECRET_KEY) {
    try {
      return Keypair.fromSecret(config.FACILITATOR_SECRET_KEY).publicKey();
    } catch {
      // fall through
    }
  }
  return "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
}

const reader = new ContractReader(
  {
    rpcUrl: config.STELLAR_RPC_URL,
    networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
    simulationSourceKey: getSimulationSource(),
  },
  logger,
);

export async function readContractValue(contractId: string, method: string, args: any[] = []): Promise<any> {
  return reader.readContractValue(contractId, method, args);
}

export async function getVaultBalance(vaultAddress: string): Promise<string> {
  const balance = await reader.readContractValue(vaultAddress, "balance");
  return balance?.toString() || "0";
}

export async function getAgentCount(registryAddress: string): Promise<number> {
  const count = await reader.readContractValue(registryAddress, "agent_count");
  return count || 0;
}

export async function getVaultForOwner(factoryAddress: string, owner: string): Promise<string | null> {
  return await reader.readContractValue(
    factoryAddress,
    "get_vault",
    [nativeToScVal(owner, { type: "address" })],
  );
}

export async function getVaultCount(factoryAddress: string): Promise<number> {
  const count = await reader.readContractValue(factoryAddress, "vault_count");
  return count || 0;
}

export async function getVaultTotalSpent(vaultAddress: string): Promise<string> {
  const total = await reader.readContractValue(vaultAddress, "total_spent");
  return total?.toString() || "0";
}

export async function listAgents(registryAddress: string, startId: number, limit: number): Promise<any[]> {
  const result = await reader.readContractValue(
    registryAddress,
    "list_agents",
    [nativeToScVal(startId, { type: "u32" }), nativeToScVal(limit, { type: "u32" })],
  );
  return result || [];
}

export async function getAgent(registryAddress: string, agentId: number): Promise<any> {
  return await reader.readContractValue(
    registryAddress,
    "get_agent",
    [nativeToScVal(agentId, { type: "u32" })],
  );
}

export async function getFeedbackSummary(reputationAddress: string, agentId: number): Promise<any> {
  return await reader.readContractValue(
    reputationAddress,
    "get_feedback_summary",
    [nativeToScVal(agentId, { type: "u32" })],
  );
}

export async function getFeedback(reputationAddress: string, agentId: number, offset: number, limit: number): Promise<any[]> {
  const result = await reader.readContractValue(
    reputationAddress,
    "get_feedback",
    [
      nativeToScVal(agentId, { type: "u32" }),
      nativeToScVal(offset, { type: "u32" }),
      nativeToScVal(limit, { type: "u32" }),
    ],
  );
  return result || [];
}

export async function getValidations(validationAddress: string, agentId: number): Promise<any[]> {
  const result = await reader.readContractValue(
    validationAddress,
    "get_validations",
    [nativeToScVal(agentId, { type: "u32" })],
  );
  return result || [];
}
