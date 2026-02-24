import { ValidationRegistry } from "@agenticocean/vault";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { getSimulationSourcePublicKey } from "../stellar/simulation-source.js";

const stellarConfig = {
  rpcUrl: config.STELLAR_RPC_URL,
  networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
  simulationSourceKey: getSimulationSourcePublicKey(),
};

export class ValidationService {
  async getValidations(agentId: number) {
    if (!config.VALIDATION_REGISTRY_ADDRESS) return [];
    const registry = new ValidationRegistry(config.VALIDATION_REGISTRY_ADDRESS, stellarConfig, logger);
    return registry.getValidations(agentId);
  }
}

export const validationService = new ValidationService();
