import { blendClient, BlendPoolData } from "./blend-client.js";
import { soroswapClient, PoolData } from "./soroswap-client.js";
import { logger } from "../logger.js";

export interface AggregatedPoolData {
  blend: BlendPoolData;
  soroswap: PoolData[];
  timestamp: number;
}

let cachedData: AggregatedPoolData | null = null;
let lastFetch = 0;
const CACHE_TTL = 60_000;

export async function scanPools(): Promise<AggregatedPoolData> {
  if (cachedData && Date.now() - lastFetch < CACHE_TTL) return cachedData;
  const [blend, soroswap] = await Promise.all([
    blendClient.loadPool(),
    soroswapClient.getPools(),
  ]);
  cachedData = { blend, soroswap, timestamp: Date.now() };
  lastFetch = Date.now();
  logger.debug("Pool scan complete", { blendReserves: blend.reserves.length, soroswapPools: soroswap.length });
  return cachedData;
}
