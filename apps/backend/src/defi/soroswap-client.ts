import { SoroswapClient } from "@agenticocean/defi-agent";
import { config } from "../config.js";
import { logger } from "../logger.js";

export type { SwapQuote, PoolData } from "@agenticocean/defi-agent";

export const soroswapClient = new SoroswapClient({
  stellarRpcUrl: config.STELLAR_RPC_URL,
  networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
  soroswapApiKey: config.SOROSWAP_API_KEY,
  usdcAddress: config.USDC_SAC_ADDRESS,
  logger,
});

export { SoroswapClient };
