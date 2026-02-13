import { createX402Middleware } from "@stellaragent402/x402-stellar";
import { config } from "../config.js";
import { logger } from "../logger.js";

const x402 = createX402Middleware({
  rpcUrl: config.STELLAR_RPC_URL,
  horizonUrl: config.STELLAR_HORIZON_URL,
  networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
  facilitatorSecret: config.FACILITATOR_SECRET_KEY,
  usdcAddress: config.USDC_SAC_ADDRESS,
  logger,
});

export function x402Middleware(routeConfig: { price: string; description: string }) {
  return x402(routeConfig);
}
