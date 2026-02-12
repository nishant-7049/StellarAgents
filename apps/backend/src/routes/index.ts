import { Router } from "express";
import { vaultRoutes } from "./vault.routes.js";
import { agentRoutes } from "./agent.routes.js";
import { statsRoutes } from "./stats.routes.js";
import { yieldRoutes } from "./yield.routes.js";
import { rebalanceRoutes } from "./rebalance.routes.js";

export const routes = Router();
routes.use("/vaults", vaultRoutes);
routes.use("/agents", agentRoutes);
routes.use("/stats", statsRoutes);
routes.use("/yield", yieldRoutes);
routes.use("/rebalance", rebalanceRoutes);
