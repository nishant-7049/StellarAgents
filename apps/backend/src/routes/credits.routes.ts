import { Router } from "express";
import { Keypair } from "@stellar/stellar-sdk";
import { creditsService, CreditPlan } from "../services/credits.service.js";
import { logger } from "../logger.js";
import { config } from "../config.js";

// Mainnet USDC classic asset issuer (Circle mainnet USDC)
const USDC_ISSUER =
  process.env.USDC_ISSUER || "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

// Address that receives credit purchase payments
const CREDITS_PAYMENT_ADDRESS =
  process.env.CREDITS_PAYMENT_ADDRESS || "GDBTV5IRAZ55D7AZ2KC26PNT63TRS4SDAZTNYQW5ECKX3UITKBRAQOSX";

export const creditsRoutes = Router();

/**
 * GET /api/credits/payment-params
 * Returns facilitator address and USDC issuer for frontend payment building.
 * Must be defined before /:wallet to avoid being matched as a wallet param.
 */
creditsRoutes.get("/payment-params", (req, res) => {
  try {
    res.json({
      facilitatorAddress: CREDITS_PAYMENT_ADDRESS,
      usdcIssuer: USDC_ISSUER,
      network: "mainnet",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/credits/:wallet
 * Returns credit balance, plan, reset date, and recent history.
 */
creditsRoutes.get("/:wallet", async (req, res) => {
  const { wallet } = req.params;
  if (!wallet) return res.status(400).json({ error: "wallet required" });

  try {
    const credits = await creditsService.getCredits(wallet);
    res.json({
      wallet: credits.wallet,
      balance: credits.balance,
      plan: credits.plan,
      monthlyQuota: credits.monthlyQuota,
      usedThisMonth: credits.usedThisMonth,
      resetDate: credits.resetDate,
      expiresAt: credits.expiresAt,
      history: credits.history.slice(-20), // last 20 entries
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/credits/consume
 * Deduct credits for an action.
 * Body: { wallet, action, count? }
 */
creditsRoutes.post("/consume", async (req, res) => {
  const { wallet, action, count = 1 } = req.body;
  if (!wallet || !action) {
    return res.status(400).json({ error: "wallet and action required" });
  }

  const validActions = ["signup", "create_vault", "register_agent", "yield_query", "execute_tx"];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: `invalid action. Valid: ${validActions.join(", ")}` });
  }

  try {
    const ok = await creditsService.consumeCredits(wallet, action, count);
    if (!ok) {
      return res.status(402).json({ error: "Insufficient credits. Please upgrade your plan." });
    }
    const credits = await creditsService.getCredits(wallet);
    res.json({ success: true, balance: credits.balance, consumed: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/credits/plans
 * Returns all available plans with XLM/USDC pricing.
 */
creditsRoutes.get("/plans/list", (_req, res) => {
  res.json({ plans: creditsService.getPlans() });
});

/**
 * POST /api/credits/purchase
 * Verify a Horizon transaction and award credits for a plan purchase.
 * Body: { wallet, plan, txHash, paymentToken }
 */
creditsRoutes.post("/purchase", async (req, res) => {
  const { wallet, plan, txHash, paymentToken } = req.body;

  if (!wallet || !plan || !txHash) {
    return res.status(400).json({ error: "wallet, plan, and txHash required" });
  }

  const validPlans: CreditPlan[] = ["free", "basic", "pro"];
  if (!validPlans.includes(plan)) {
    return res.status(400).json({ error: "invalid plan" });
  }

  if (plan === "free") {
    return res.status(400).json({ error: "free plan does not require payment" });
  }

  try {
    // Demo mode: txHashes starting with "demo_" bypass Horizon verification
    const isDemo = txHash.startsWith("demo_");
    let paymentVerified = isDemo;

    if (isDemo) {
      logger.warn("Demo purchase — skipping Horizon verification", { wallet, plan, txHash });
    } else {
      // Verify the transaction on Horizon
      const horizonUrl = config.STELLAR_HORIZON_URL || "https://horizon.stellar.org";
      const horizonResp = await fetch(`${horizonUrl}/transactions/${txHash}`);

      if (!horizonResp.ok) {
        return res.status(400).json({ error: "Transaction not found on Horizon" });
      }

      const tx = await horizonResp.json() as any;
      if (!tx.successful) {
        return res.status(400).json({ error: "Transaction was not successful" });
      }

      // Get operations to verify the payment
      const opsResp = await fetch(`${horizonUrl}/transactions/${txHash}/operations`);
      if (!opsResp.ok) {
        return res.status(400).json({ error: "Could not fetch operations" });
      }

      const opsData = await opsResp.json() as any;
      const ops = opsData._embedded?.records || [];

      const { PLAN_PRICES_USDC } = await import("../services/credits.service.js");
      const expectedUsdc = PLAN_PRICES_USDC[plan as CreditPlan];

      for (const op of ops) {
        if (op.type === "payment" && op.to === CREDITS_PAYMENT_ADDRESS) {
          const amount = parseFloat(op.amount);
          const isUSDC = op.asset_code === "USDC" && amount >= expectedUsdc;
          if (isUSDC) {
            paymentVerified = true;
            break;
          }
        }
      }
    }

    if (!paymentVerified) {
      return res.status(400).json({ error: "Payment amount does not match plan price" });
    }

    // Award credits
    const credits = await creditsService.setPlan(wallet, plan as CreditPlan);
    logger.info("Plan purchased", { wallet, plan, txHash });

    res.json({
      success: true,
      wallet: credits.wallet,
      plan: credits.plan,
      balance: credits.balance,
      message: `Successfully upgraded to ${plan} plan`,
    });
  } catch (err: any) {
    logger.error("Purchase failed", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});
