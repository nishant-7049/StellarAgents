import { SoroswapClient } from "@agentsea/agent-ai";
import { config } from "../config.js";
import { logger } from "../logger.js";

export type { SwapQuote, PoolData } from "@agentsea/agent-ai";

export const soroswapClient = new SoroswapClient({
  stellarRpcUrl: config.STELLAR_RPC_URL,
  networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
  soroswapApiKey: config.SOROSWAP_API_KEY,
  usdcAddress: config.USDC_SAC_ADDRESS,
  logger,
});

export { SoroswapClient };
