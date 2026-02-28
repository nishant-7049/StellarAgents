import { Router } from "express";
import { agentService } from "../services/agent.service.js";
import { logger } from "../logger.js";

export const agentRoutes = Router();

agentRoutes.get("/", async (req, res) => {
  const startId = parseInt(req.query.startId as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  try {
    const agents = await agentService.listAgents(startId, limit);
    const count = await agentService.getAgentCount();
    res.json({ registry: agentService.getRegistryAddress(), agents, totalActive: count });
  } catch (err) {
    logger.error("Failed to list agents", { error: err });
    res.json({ registry: agentService.getRegistryAddress(), agents: [], totalActive: 0 });
  }
});

agentRoutes.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid agent ID" });
  }
  try {
    const agent = await agentService.getAgent(id);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    res.json(agent);
  } catch (err) {
    logger.error("Failed to get agent", { id, error: err });
    res.status(500).json({ error: "Failed to get agent" });
  }
});

agentRoutes.post("/", async (req, res) => {
  const { name, capabilities, pricing } = req.body;
  res.json({ message: "Agent registered (use Freighter for on-chain registration)", name, capabilities, pricing });
});
