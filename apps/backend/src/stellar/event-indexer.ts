import { Server } from "@stellar/stellar-sdk/rpc";
import { config } from "../config.js";
import { logger } from "../logger.js";

const rpc = new Server(config.STELLAR_RPC_URL);

interface IndexedEvent {
  contractId: string;
  topic: string[];
  value: any;
  ledger: number;
  timestamp: number;
}

const events: IndexedEvent[] = [];
let latestLedger: string | undefined;
const MAX_EVENTS = 1000;

function getContractIds(): string[] {
  return [
    config.VAULT_FACTORY_ADDRESS,
    config.AGENT_REGISTRY_ADDRESS,
    config.REPUTATION_REGISTRY_ADDRESS,
    config.VALIDATION_REGISTRY_ADDRESS,
  ].filter(Boolean);
}

async function pollEvents() {
  const contractIds = getContractIds();
  if (contractIds.length === 0) return;

  try {
    const latest = await rpc.getLatestLedger();
    // Only look back 100 ledgers (~8 min) to avoid RPC range errors
    const startLedger = latestLedger
      ? undefined
      : Math.max(1, latest.sequence - 100);

    for (const contractId of contractIds) {
      try {
        const filters = [{
          type: "contract" as const,
          contractIds: [contractId],
        }];

        const params: any = { filters, limit: 50 };
        if (latestLedger) {
          // cursor must be "ledger-txIndex-eventIndex" format
          params.cursor = latestLedger;
        } else if (startLedger) {
          params.startLedger = startLedger;
        }

        const result = await rpc.getEvents(params);

        if (result.events) {
          for (const evt of result.events) {
            events.push({
              contractId: (evt.contractId || contractId) as string,
              topic: evt.topic?.map((t: any) => t.toString()) || [],
              value: evt.value,
              ledger: evt.ledger || 0,
              timestamp: Date.now(),
            });
            // Use the event's own paging token as the cursor for next poll
            if ((evt as any).pagingToken) {
              latestLedger = (evt as any).pagingToken;
            }
          }
        }

        if (!latestLedger && result.latestLedger) {
          // Build a cursor from latest ledger so next poll starts from here
          latestLedger = `${result.latestLedger}-0-0`;
        }
      } catch (err) {
        // Silently skip — contracts may have no events yet
        logger.debug("Event poll failed for contract", { contractId, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // Trim to max size
    while (events.length > MAX_EVENTS) {
      events.shift();
    }
  } catch (err) {
    logger.debug("Event polling error", { error: String(err) });
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
