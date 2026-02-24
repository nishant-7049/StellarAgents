import { Router } from "express";
import { getEvents } from "../stellar/event-indexer.js";
import { Server } from "@stellar/stellar-sdk/rpc";
import { scValToNative } from "@stellar/stellar-sdk";
import { config } from "../config.js";
import { logger } from "../logger.js";

export const eventsRoutes = Router();

const rpc = new Server(config.STELLAR_RPC_URL);

eventsRoutes.get("/", async (req, res) => {
  const contractId = req.query.contractId as string | undefined;
  const limit = parseInt(req.query.limit as string) || 50;

  // If contractId is provided and not in our indexed contracts, query RPC directly
  if (contractId && contractId.startsWith('C')) {
    try {
      const latestLedger = await rpc.getLatestLedger();
      const startLedger = latestLedger.sequence - 10000; // Last ~14 hours on testnet

      const result = await rpc.getEvents({
        filters: [{
          type: "contract" as const,
          contractIds: [contractId],
        }],
        startLedger,
        limit: Math.min(limit, 100),
      });

      const events = (result.events || []).map((evt: any, i: number) => {
        // Parse topic (usually contains event name/type)
        const topic = evt.topic?.map((t: any) => {
          try {
            const parsed = scValToNative(t);
            return typeof parsed === 'string' ? parsed : String(parsed);
          } catch {
            return t.toString();
          }
        }) || [];

        // Parse value (event data) and convert BigInt to string
        let parsedValue: any;
        try {
          const native = scValToNative(evt.value);
          // Convert BigInts to strings recursively
          parsedValue = JSON.parse(JSON.stringify(native, (_, v) =>
            typeof v === 'bigint' ? v.toString() : v
          ));
        } catch {
          parsedValue = null;
        }

        // Extract amount and address if it's a deposit/withdraw event
        let amount: string | undefined;
        let from: string | undefined;
        if (Array.isArray(parsedValue) && parsedValue.length >= 2) {
          from = String(parsedValue[0]); // First element is usually the address
          amount = String(parsedValue[1]); // Second element is usually the amount
        }

        return {
          contractId: String(evt.contractId || contractId),
          topic,
          value: parsedValue,
          amount,
          from,
          ledger: evt.ledger || 0,
          timestamp: Date.now() - (result.events.length - i) * 5000, // Approximate
          txHash: String(evt.txHash || ''),
          type: topic[0] || 'contract_event',
        };
      });

      return res.json({ events, count: events.length });
    } catch (err: any) {
      const errorContext = err instanceof Error
        ? { message: err.message, stack: err.stack }
        : {
            message: err?.message || "RPC error",
            code: err?.code,
            data: err?.data,
          };
      logger.warn("Failed to fetch contract events", { contractId, error: errorContext });
      return res.json({ events: [], count: 0 });
    }
  }

  // Otherwise use indexed events
  const events = getEvents(contractId, limit);
  res.json({ events, count: events.length });
});
