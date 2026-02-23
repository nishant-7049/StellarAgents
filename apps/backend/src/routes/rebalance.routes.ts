import { Router } from "express";
import { getRebalancerStatus, triggerRebalance } from "../defi/rebalancer.js";

export const rebalanceRoutes = Router();

rebalanceRoutes.get("/status", async (_req, res) => {
  res.json(getRebalancerStatus());
});

rebalanceRoutes.post("/trigger", async (_req, res) => {
  res.json({ message: "Rebalance check triggered", status: "ok" });
  // Run async after responding so the HTTP request doesn't hang
  triggerRebalance().catch(() => {});
});
