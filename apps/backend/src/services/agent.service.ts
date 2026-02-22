import { AgentRegistry } from "@agenticocean/vault";
import { Keypair } from "@stellar/stellar-sdk";
import { config } from "../config.js";
import { logger } from "../logger.js";

function getSimulationSource(): string | undefined {
  if (config.FACILITATOR_SECRET_KEY) {
    try {
      return Keypair.fromSecret(config.FACILITATOR_SECRET_KEY).publicKey();
    } catch {
      // fall through
    }
  }
  return undefined;
}

const stellarConfig = {
  rpcUrl: config.STELLAR_RPC_URL,
  networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
  simulationSourceKey: getSimulationSource(),
};

export class AgentService {
  getRegistryAddress(): string {
    return config.AGENT_REGISTRY_ADDRESS;
  }

  async listAgents(startTokenId: number = 1, limit: number = 10) {
    if (!config.AGENT_REGISTRY_ADDRESS) return [];
    const registry = new AgentRegistry(config.AGENT_REGISTRY_ADDRESS, stellarConfig, logger);
    return registry.listAgents(startTokenId, limit);
  }

  async getAgent(tokenId: number) {
    if (!config.AGENT_REGISTRY_ADDRESS) return null;
    const registry = new AgentRegistry(config.AGENT_REGISTRY_ADDRESS, stellarConfig, logger);
    return registry.getAgent(tokenId);
  }

  async listOwnerTokens(owner: string, offset: number = 0, limit: number = 20): Promise<number[]> {
    if (!config.AGENT_REGISTRY_ADDRESS) return [];
    const registry = new AgentRegistry(config.AGENT_REGISTRY_ADDRESS, stellarConfig, logger);
    return registry.listTokensByOwner(owner, offset, limit);
  }

  async getPrimaryAgentToken(owner: string): Promise<number | null> {
    const tokens = await this.listOwnerTokens(owner, 0, 1);
    if (!tokens || tokens.length === 0) return null;
    return Number(tokens[0]);
  }

  async getAgentCount(): Promise<number> {
    if (!config.AGENT_REGISTRY_ADDRESS) return 0;
    const registry = new AgentRegistry(config.AGENT_REGISTRY_ADDRESS, stellarConfig, logger);
    return registry.getActiveCount();
  }
}

export const agentService = new AgentService();
