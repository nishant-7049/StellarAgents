import { Router } from "express";
import { config } from "../config.js";

export const agentRoutes = Router();

agentRoutes.get("/", async (_req, res) => {
  res.json({
    registry: config.AGENT_REGISTRY_ADDRESS,
    agents: [
      {
        id: 1,
        name: "Yield Optimizer",
        capabilities: ["yield", "rebalance"],
        pricing: { amount: "100000", asset: "USDC" },
        status: "active",
      },
      {
        id: 2,
        name: "Risk Analyzer",
        capabilities: ["risk", "portfolio"],
        pricing: { amount: "50000", asset: "USDC" },
        status: "active",
      },
    ],
  });
});

agentRoutes.post("/", async (req, res) => {
  const { name, capabilities, pricing } = req.body;
  res.json({ message: "Agent registered", name, capabilities, pricing });
});
