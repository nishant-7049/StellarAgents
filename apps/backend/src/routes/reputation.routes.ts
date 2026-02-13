import { Router } from "express";
import { reputationService } from "../services/reputation.service.js";
import { logger } from "../logger.js";

export const reputationRoutes = Router();

reputationRoutes.get("/:agentId/summary", async (req, res) => {
  const agentId = parseInt(req.params.agentId);
  if (isNaN(agentId)) {
    return res.status(400).json({ error: "Invalid agent ID" });
  }
  try {
    const summary = await reputationService.getSummary(agentId);
    res.json(summary);
  } catch (err) {
    logger.error("Failed to get reputation summary", { agentId, error: err });
    res.json({ total_reviews: 0, avg_score_x100: 0, category_counts: 0, total_score: 0 });
  }
});

reputationRoutes.get("/:agentId/feedback", async (req, res) => {
  const agentId = parseInt(req.params.agentId);
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = parseInt(req.query.limit as string) || 10;
  if (isNaN(agentId)) {
    return res.status(400).json({ error: "Invalid agent ID" });
  }
  try {
    const feedback = await reputationService.getFeedback(agentId, offset, limit);
    res.json({ agentId, feedback, offset, limit });
  } catch (err) {
    logger.error("Failed to get feedback", { agentId, error: err });
    res.json({ agentId, feedback: [], offset, limit });
  }
});
