import { BlendClient } from "@stellaragent402/agent-ai";
import { config } from "../config.js";
import { logger } from "../logger.js";

export type { BlendPoolData, UserBlendPosition } from "@stellaragent402/agent-ai";

export const blendClient = new BlendClient({
  stellarRpcUrl: config.STELLAR_RPC_URL,
  networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
  usdcAddress: config.USDC_SAC_ADDRESS,
  blendPoolId: config.BLEND_POOL_USDC,
  logger,
});

export { BlendClient };
