import { Router } from "express";

export const statsRoutes = Router();

statsRoutes.get("/", async (_req, res) => {
  res.json({
    totalVaults: 0,
    totalAgents: 0,
    totalTransactions: 0,
    totalVolumeUsdc: "0",
    network: "testnet",
  });
});
