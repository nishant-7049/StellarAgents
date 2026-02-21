import { AgentRegistry } from "@agentsea/vault";
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

  async listAgents(startId: number = 1, limit: number = 10) {
    if (!config.AGENT_REGISTRY_ADDRESS) return [];
    const registry = new AgentRegistry(config.AGENT_REGISTRY_ADDRESS, stellarConfig, logger);
    return registry.listAgents(startId, limit);
  }

  async getAgent(agentId: number) {
    if (!config.AGENT_REGISTRY_ADDRESS) return null;
    const registry = new AgentRegistry(config.AGENT_REGISTRY_ADDRESS, stellarConfig, logger);
    return registry.getAgent(agentId);
  }

  async getAgentByOwner(owner: string): Promise<number | null> {
    if (!config.AGENT_REGISTRY_ADDRESS) return null;
    const registry = new AgentRegistry(config.AGENT_REGISTRY_ADDRESS, stellarConfig, logger);
    return registry.getAgentByOwner(owner);
  }

  async getAgentCount(): Promise<number> {
    if (!config.AGENT_REGISTRY_ADDRESS) return 0;
    const registry = new AgentRegistry(config.AGENT_REGISTRY_ADDRESS, stellarConfig, logger);
    return registry.getAgentCount();
  }
}

export const agentService = new AgentService();
