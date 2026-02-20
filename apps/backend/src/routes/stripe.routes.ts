import { Router } from "express";
import Stripe from "stripe";
import { creditsService, CreditPlan } from "../services/credits.service.js";
import { config } from "../config.js";
import { logger } from "../logger.js";

export const stripeRoutes = Router();

function getStripe(): Stripe | null {
  if (!config.STRIPE_SECRET_KEY) return null;
  return new Stripe(config.STRIPE_SECRET_KEY);
}

const STRIPE_PRICES: Record<string, number> = {
  basic: 500,   // $5.00
  pro: 1500,    // $15.00
};

const PLAN_NAMES: Record<string, string> = {
  basic: "Basic Plan — 500 credits/month",
  pro:   "Pro Plan — 2000 credits/month",
};

/**
 * POST /api/credits/stripe/checkout
 * Creates a Stripe Checkout Session.
 * Body: { wallet, plan }
 * Returns: { url }
 */
stripeRoutes.post("/checkout", async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: "Stripe not configured on this server" });

  const { wallet, plan } = req.body;
  if (!wallet || !plan) return res.status(400).json({ error: "wallet and plan required" });
  if (!["basic", "pro"].includes(plan)) return res.status(400).json({ error: "invalid plan" });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: PLAN_NAMES[plan],
            description: "AgentNet402 — valid for 30 days",
          },
          unit_amount: STRIPE_PRICES[plan],
        },
        quantity: 1,
      }],
      metadata: { wallet, plan },
      success_url: `${config.FRONTEND_URL}/credits?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${config.FRONTEND_URL}/credits?canceled=true`,
    });

    logger.info("Stripe checkout created", { wallet, plan, sessionId: session.id });
    res.json({ url: session.url });
  } catch (err: any) {
    logger.error("Stripe checkout failed", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/credits/stripe/webhook
 * Called by Stripe when payment completes.
 * Uses req.rawBody (set by express.json verify in index.ts) for signature verification.
 */
stripeRoutes.post("/webhook", async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: "Stripe not configured" });

  const sig = req.headers["stripe-signature"] as string;
  if (!config.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: "STRIPE_WEBHOOK_SECRET not set" });
  }

  let event: Stripe.Event;
  try {
    // req.rawBody is attached by the verify fn in express.json() — see index.ts
    const raw = (req as any).rawBody as Buffer;
    event = stripe.webhooks.constructEvent(raw, sig, config.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    logger.warn("Stripe webhook signature invalid", { error: err.message });
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { wallet, plan } = session.metadata || {};

    if (wallet && plan) {
      try {
        creditsService.setPlan(wallet, plan as CreditPlan);
        logger.info("Plan upgraded via Stripe", { wallet, plan, sessionId: session.id });
      } catch (err: any) {
        logger.error("Failed to set plan after Stripe payment", { error: err.message });
      }
    }
  }

  res.json({ received: true });
});
