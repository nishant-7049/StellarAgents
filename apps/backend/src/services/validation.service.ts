import { ValidationRegistry } from "@agentsea/vault";
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

export class ValidationService {
  async getValidations(agentId: number) {
    if (!config.VALIDATION_REGISTRY_ADDRESS) return [];
    const registry = new ValidationRegistry(config.VALIDATION_REGISTRY_ADDRESS, stellarConfig, logger);
    return registry.getValidations(agentId);
  }
}

export const validationService = new ValidationService();
