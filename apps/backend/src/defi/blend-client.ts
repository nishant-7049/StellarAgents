import { BlendClient } from "@agentsea/defi-agent";
import { config } from "../config.js";
import { logger } from "../logger.js";

export type { BlendPoolData, UserBlendPosition } from "@agentsea/defi-agent";

export const blendClient = new BlendClient({
  stellarRpcUrl: config.STELLAR_RPC_URL,
  networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
  usdcAddress: config.USDC_SAC_ADDRESS,
  blendPoolId: config.BLEND_POOL_USDC,
  logger,
});

export { BlendClient };
