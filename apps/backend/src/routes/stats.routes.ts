import { Router } from "express";
import { config } from "../config.js";
import { getVaultCount, getAgentCount } from "../stellar/contract-reader.js";
import { logger } from "../logger.js";

export const statsRoutes = Router();

statsRoutes.get("/", async (_req, res) => {
  try {
    const [totalVaults, totalAgents] = await Promise.all([
      config.VAULT_FACTORY_ADDRESS ? getVaultCount(config.VAULT_FACTORY_ADDRESS) : 0,
      config.AGENT_REGISTRY_ADDRESS ? getAgentCount(config.AGENT_REGISTRY_ADDRESS) : 0,
    ]);

    res.json({
      totalVaults,
      totalAgents,
      totalTransactions: 0,
      totalVolumeUsdc: "0",
      network: "testnet",
    });
  } catch (err) {
    logger.error("Failed to get stats", { error: err });
    res.json({
      totalVaults: 0,
      totalAgents: 0,
      totalTransactions: 0,
      totalVolumeUsdc: "0",
      network: "testnet",
    });
  }
});
