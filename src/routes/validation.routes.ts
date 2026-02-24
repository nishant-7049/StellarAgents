import { Router } from "express";
import { validationService } from "../services/validation.service.js";
import { logger } from "../logger.js";

export const validationRoutes = Router();

validationRoutes.get("/:agentId", async (req, res) => {
  const agentId = parseInt(req.params.agentId);
  if (isNaN(agentId)) {
    return res.status(400).json({ error: "Invalid agent ID" });
  }
  try {
    const validations = await validationService.getValidations(agentId);
    res.json({ agentId, validations });
  } catch (err) {
    logger.error("Failed to get validations", { agentId, error: err });
    res.json({ agentId, validations: [] });
  }
});
