import { Router } from "express";
import { getEvents } from "../stellar/event-indexer.js";

export const eventsRoutes = Router();

eventsRoutes.get("/", async (req, res) => {
  const contractId = req.query.contractId as string | undefined;
  const limit = parseInt(req.query.limit as string) || 50;
  const events = getEvents(contractId, limit);
  res.json({ events, count: events.length });
});
