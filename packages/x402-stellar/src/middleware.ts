import { Keypair } from "@stellar/stellar-sdk";
import { settlePayment } from "./facilitator.js";
import type { X402RouteConfig, LoggerLike } from "./types.js";

export interface X402MiddlewareOptions {
  rpcUrl: string;
  horizonUrl: string;
  networkPassphrase: string;
  facilitatorSecret: string;
  usdcAddress: string;
  logger?: LoggerLike;
}

/**
 * Factory that creates an x402 middleware function for Express.
 *
 * Usage:
 * ```ts
 * const x402 = createX402Middleware({
 *   rpcUrl: "https://soroban-testnet.stellar.org",
 *   horizonUrl: "https://horizon-testnet.stellar.org",
 *   networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE!,
 *   facilitatorSecret: "S...",
 *   usdcAddress: "C...",
 * });
 *
 * app.use("/api/paid", x402({ price: "100000", description: "Query" }));
 * ```
 */
export function createX402Middleware(options: X402MiddlewareOptions) {
  const log = options.logger ?? console;
  const facilitatorPubkey = options.facilitatorSecret
    ? Keypair.fromSecret(options.facilitatorSecret).publicKey()
    : "GFACILITATOR_PLACEHOLDER";

  return function x402(routeConfig: X402RouteConfig) {
    return async (req: any, res: any, next: any) => {
      const paymentHeader = req.headers["x-payment"] as string | undefined;

      if (!paymentHeader) {
        return res.status(402).json({
          x402Version: 1,
          accepts: [{
            scheme: "stellar-vault",
            network: "stellar:testnet",
            asset: options.usdcAddress,
            amount: routeConfig.price,
            payTo: facilitatorPubkey,
            maxTimeoutSeconds: 60,
            description: routeConfig.description,
          }],
        });
      }

      try {
        const payload = JSON.parse(
          Buffer.from(paymentHeader, "base64").toString("utf-8")
        );

        if (payload.scheme !== "stellar-vault") {
          return res.status(402).json({ error: "unsupported scheme" });
        }
        if (BigInt(payload.payload.amount) < BigInt(routeConfig.price)) {
          return res.status(402).json({ error: "insufficient amount" });
        }

        const result = await settlePayment(payload, {
          rpcUrl: options.rpcUrl,
          horizonUrl: options.horizonUrl,
          networkPassphrase: options.networkPassphrase,
          facilitatorSecret: options.facilitatorSecret,
          logger: log,
        });

        if (result.success) {
          req.x402 = {
            txHash: result.txHash,
            payer: payload.payload.vaultContract,
            agentId: payload.payload.agentId,
          };
          res.setHeader("X-PAYMENT-RESPONSE", JSON.stringify({
            txHash: result.txHash,
            network: "stellar:testnet",
          }));
          return next();
        }

        return res.status(402).json({ error: result.error });
      } catch (err: any) {
        log.error("x402 payment failed", { error: err.message });
        return res.status(402).json({ error: err.message });
      }
    };
  };
}
