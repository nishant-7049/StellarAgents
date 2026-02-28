import { ReputationRegistry } from "@agenticocean/vault";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { getSimulationSourcePublicKey } from "../stellar/simulation-source.js";

const stellarConfig = {
  rpcUrl: config.STELLAR_RPC_URL,
  networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
  simulationSourceKey: getSimulationSourcePublicKey(),
};

export class ReputationService {
  async getSummary(agentId: number) {
    if (!config.REPUTATION_REGISTRY_ADDRESS) {
      return { total_reviews: 0, avg_score_x100: 0, category_counts: 0, total_score: 0 };
    }
    const registry = new ReputationRegistry(config.REPUTATION_REGISTRY_ADDRESS, stellarConfig, logger);
    return registry.getSummary(agentId);
  }

  async getFeedback(agentId: number, offset: number = 0, limit: number = 10) {
    if (!config.REPUTATION_REGISTRY_ADDRESS) return [];
    const registry = new ReputationRegistry(config.REPUTATION_REGISTRY_ADDRESS, stellarConfig, logger);
    return registry.getFeedback(agentId, offset, limit);
  }
}

export const reputationService = new ReputationService();
