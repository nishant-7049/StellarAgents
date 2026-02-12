import { Request, Response, NextFunction } from "express";
import { settlePayment } from "../x402/facilitator.js";
import { config } from "../config.js";
import { Keypair } from "@stellar/stellar-sdk";
import { logger } from "../logger.js";

interface X402RouteConfig {
  price: string;
  description: string;
}

export function x402Middleware(routeConfig: X402RouteConfig) {
  const facilitatorPubkey = config.FACILITATOR_SECRET_KEY
    ? Keypair.fromSecret(config.FACILITATOR_SECRET_KEY).publicKey()
    : "GFACILITATOR_PLACEHOLDER";

  return async (req: Request, res: Response, next: NextFunction) => {
    const paymentHeader = req.headers["x-payment"] as string | undefined;

    if (!paymentHeader) {
      return res.status(402).json({
        x402Version: 1,
        accepts: [{
          scheme: "stellar-vault",
          network: "stellar:testnet",
          asset: config.USDC_SAC_ADDRESS,
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

      const result = await settlePayment(payload);

      if (result.success) {
        (req as any).x402 = {
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
      logger.error("x402 payment failed", { error: err.message });
      return res.status(402).json({ error: err.message });
    }
  };
}
