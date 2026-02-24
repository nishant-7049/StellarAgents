import { Server } from "@stellar/stellar-sdk/rpc";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { triggerRebalance } from "../defi/rebalancer.js";

const rpc = new Server(config.STELLAR_RPC_URL);

interface IndexedEvent {
  contractId: string;
  topic: string[];
  value: any;
  ledger: number;
  timestamp: number;
}

const events: IndexedEvent[] = [];
let latestCursor: string | undefined;
const MAX_EVENTS = 1000;

type RpcLikeError = {
  message?: string;
  code?: number | string;
  data?: unknown;
};

function toErrorContext(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack };
  }

  if (err && typeof err === "object") {
    const e = err as RpcLikeError & Record<string, unknown>;
    const context: Record<string, unknown> = {
      message: typeof e.message === "string" ? e.message : "RPC error",
    };

    if (e.code !== undefined) context.code = e.code;
    if (e.data !== undefined) context.data = e.data;

    // Preserve extra enumerable fields for debugging (Axios / RPC errors).
    for (const [k, v] of Object.entries(e)) {
      if (!(k in context)) context[k] = v;
    }
    return context;
  }

  return { message: String(err) };
}

function isCursorError(err: unknown): boolean {
  const ctx = toErrorContext(err);
  const text = `${ctx.message ?? ""} ${JSON.stringify(ctx.data ?? "")}`.toLowerCase();
  return text.includes("cursor");
}

async function fetchEventsWithRetry(
  contractId: string,
  startLedger: number | undefined,
): Promise<any> {
  const filters = [{
    type: "contract" as const,
    contractIds: [contractId],
  }];

  const firstParams: any = { filters, limit: 50 };
  if (latestCursor) {
    firstParams.cursor = latestCursor;
  } else if (startLedger) {
    firstParams.startLedger = startLedger;
  }

  try {
    return await rpc.getEvents(firstParams);
  } catch (err) {
    if (latestCursor && isCursorError(err)) {
      const resetTo = startLedger ?? 1;
      logger.warn("Event cursor invalid, resetting cursor and retrying contract poll", {
        contractId,
        cursor: latestCursor,
        resetStartLedger: resetTo,
        error: toErrorContext(err),
      });
      latestCursor = undefined;
      return await rpc.getEvents({ filters, limit: 50, startLedger: resetTo });
    }
    throw err;
  }
}

function getContractIds(): string[] {
  return [
    config.VAULT_FACTORY_ADDRESS,
    config.AGENT_REGISTRY_ADDRESS,
    config.REPUTATION_REGISTRY_ADDRESS,
    config.VALIDATION_REGISTRY_ADDRESS,
    config.ADMIN_VAULT_ADDRESS,   // watch our vault for agent_added events
  ].filter(Boolean);
}

async function pollEvents() {
  const contractIds = getContractIds();
  if (contractIds.length === 0) return;

  try {
    const latest = await rpc.getLatestLedger();
    // Only look back 100 ledgers (~8 min) to avoid RPC range errors
    const startLedger = latestCursor
      ? undefined
      : Math.max(1, latest.sequence - 100);

    for (const contractId of contractIds) {
      try {
        const result = await fetchEventsWithRetry(contractId, startLedger);

        // Use server-provided cursor for robust pagination, even when no events returned.
        if (result.cursor) {
          latestCursor = result.cursor;
        }

        if (result.events) {
          for (const evt of result.events) {
            const topics: string[] = evt.topic?.map((t: any) => t.toString()) || [];
            events.push({
              contractId: (evt.contractId || contractId) as string,
              topic: topics,
              value: evt.value,
              ledger: evt.ledger || 0,
              timestamp: Date.now(),
            });
            // If our vault just got a new agent authorized → trigger rebalancer immediately
            if (
              contractId === config.ADMIN_VAULT_ADDRESS &&
              topics.some((t: string) => t.includes("agent_added"))
            ) {
              logger.info("agent_added event on vault — triggering rebalancer immediately");
              triggerRebalance().catch(() => {});
            }
          }
        }

      } catch (err) {
        logger.debug("Event poll failed for contract", {
          contractId,
          error: toErrorContext(err),
          cursor: latestCursor,
          rpcUrl: config.STELLAR_RPC_URL,
        });
      }
    }

    // Trim to max size
    while (events.length > MAX_EVENTS) {
      events.shift();
    }
  } catch (err) {
    logger.debug("Event polling error", {
      error: toErrorContext(err),
      cursor: latestCursor,
      rpcUrl: config.STELLAR_RPC_URL,
    });
  }
}

export function getEvents(contractId?: string, limit: number = 50): IndexedEvent[] {
  let filtered = contractId
    ? events.filter(e => e.contractId === contractId)
    : events;
  return filtered.slice(-limit);
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startEventIndexer() {
  if (intervalId) return;
  logger.info("Starting event indexer (30s interval)");
  pollEvents(); // Initial poll
  intervalId = setInterval(pollEvents, 30_000);
}

export function stopEventIndexer() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
