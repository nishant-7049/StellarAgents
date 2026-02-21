import { VaultFactory, UserVault } from "@agentsea/vault";
import { Keypair } from "@stellar/stellar-sdk";
import { config } from "../config.js";
import { logger } from "../logger.js";

function getSimulationSource(): string {
  if (config.FACILITATOR_SECRET_KEY) {
    try {
      return Keypair.fromSecret(config.FACILITATOR_SECRET_KEY).publicKey();
    } catch {
      // fall through
    }
  }
  return undefined as any;
}

const stellarConfig = {
  rpcUrl: config.STELLAR_RPC_URL,
  networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
  simulationSourceKey: getSimulationSource(),
};

export class VaultService {
  async getVaultForOwner(owner: string): Promise<string | null> {
    if (!config.VAULT_FACTORY_ADDRESS) return null;
    try {
      const factory = new VaultFactory(config.VAULT_FACTORY_ADDRESS, stellarConfig, logger);
      return await factory.getVault(owner);
    } catch {
      return null;
    }
  }

  async getBalance(vaultAddress: string): Promise<string> {
    const vault = new UserVault(vaultAddress, stellarConfig, logger);
    return vault.getBalance();
  }

  async getTotalSpent(vaultAddress: string): Promise<string> {
    const vault = new UserVault(vaultAddress, stellarConfig, logger);
    return vault.getTotalSpent();
  }

  async getAgentPolicy(vaultAddress: string, agentAddress: string): Promise<any> {
    const vault = new UserVault(vaultAddress, stellarConfig, logger);
    return vault.getAgentPolicy(agentAddress);
  }

  async getRemainingLimit(vaultAddress: string, agentAddress: string): Promise<string> {
    const vault = new UserVault(vaultAddress, stellarConfig, logger);
    return vault.getRemainingLimit(agentAddress);
  }
}

export const vaultService = new VaultService();
