import { VaultFactory, UserVault } from "@agenticocean/vault";
import { Keypair } from "@stellar/stellar-sdk";
import { config } from "../config.js";
import { logger } from "../logger.js";

function makeConfig(simulationSourceKey?: string) {
  return {
    rpcUrl: config.STELLAR_RPC_URL,
    networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
    simulationSourceKey,
  };
}

export class VaultService {
  async getVaultForOwner(owner: string): Promise<string | null> {
    if (!config.VAULT_FACTORY_ADDRESS) return null;
    try {
      // Use the owner as simulation source — they exist on mainnet by definition
      const factory = new VaultFactory(config.VAULT_FACTORY_ADDRESS, makeConfig(owner), logger);
      return await factory.getVault(owner);
    } catch {
      return null;
    }
  }

  async getBalance(vaultAddress: string, owner?: string): Promise<string> {
    const vault = new UserVault(vaultAddress, makeConfig(owner), logger);
    return vault.getBalance();
  }

  async getTotalSpent(vaultAddress: string, owner?: string): Promise<string> {
    const vault = new UserVault(vaultAddress, makeConfig(owner), logger);
    return vault.getTotalSpent();
  }

  async getAgentPolicy(vaultAddress: string, agentAddress: string, owner?: string): Promise<any> {
    const vault = new UserVault(vaultAddress, makeConfig(owner), logger);
    return vault.getAgentPolicy(agentAddress);
  }

  async getRemainingLimit(vaultAddress: string, agentAddress: string, owner?: string): Promise<string> {
    const vault = new UserVault(vaultAddress, makeConfig(owner), logger);
    return vault.getRemainingLimit(agentAddress);
  }
}

export const vaultService = new VaultService();
