/**
 * Platform Credit System — MongoDB (Mongoose) backend
 *
 * Credit costs per action:
 *   signup          → 100 free credits (awarded, not charged)
 *   create_vault    → 10 credits
 *   register_agent  → 20 credits
 *   yield_query     → 5 credits
 *   execute_tx      → 2 credits
 *
 * Plans:
 *   free  → 100/mo  ($0)
 *   basic → 500/mo  ($5  USDC / 50 XLM)
 *   pro   → 2000/mo ($15 USDC / 150 XLM)
 */

import { logger } from "../logger.js";
import { CreditsModel } from "../db/credits.model.js";

export type CreditAction =
  | "signup"
  | "create_vault"
  | "register_agent"
  | "yield_query"
  | "execute_tx";

export type CreditPlan = "free" | "basic" | "pro";

export interface CreditHistoryEntry {
  action: CreditAction;
  amount: number;
  timestamp: string;
  note?: string;
}

export interface WalletCredits {
  wallet: string;
  balance: number;
  plan: CreditPlan;
  monthlyQuota: number;
  usedThisMonth: number;
  resetDate: string;
  expiresAt?: string;
  history: CreditHistoryEntry[];
  createdAt: string;
}

export const CREDIT_COSTS: Record<CreditAction, number> = {
  signup:         0,
  create_vault:   10,
  register_agent: 20,
  yield_query:    5,
  execute_tx:     2,
};

export const PLAN_QUOTAS: Record<CreditPlan, number> = {
  free:  100,
  basic: 500,
  pro:   2000,
};

export const PLAN_PRICES_USDC: Record<CreditPlan, number> = {
  free:  0,
  basic: 5,
  pro:   15,
};

export const PLAN_PRICES_XLM: Record<CreditPlan, number> = {
  free:  0,
  basic: 50,
  pro:   150,
};

function nextResetDate(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
}

function toPlain(doc: any): WalletCredits {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    wallet:        obj.wallet,
    balance:       obj.balance,
    plan:          obj.plan,
    monthlyQuota:  obj.monthlyQuota,
    usedThisMonth: obj.usedThisMonth,
    resetDate:     obj.resetDate,
    expiresAt:     obj.expiresAt,
    history:       obj.history ?? [],
    createdAt:     obj.createdAt,
  };
}

export const creditsService = {
  /**
   * Get credits for a wallet. Creates the record if it doesn't exist yet.
   * Also handles monthly quota reset automatically.
   */
  async getCredits(wallet: string): Promise<WalletCredits> {
    const now = new Date();

    let doc = await CreditsModel.findOne({ wallet });

    if (!doc) {
      // First time — create with signup bonus
      doc = await CreditsModel.create({
        wallet,
        balance:       100,
        plan:          "free",
        monthlyQuota:  PLAN_QUOTAS.free,
        usedThisMonth: 0,
        resetDate:     nextResetDate(),
        history: [{
          action:    "signup",
          amount:    100,
          timestamp: now.toISOString(),
          note:      "Welcome bonus",
        }],
        createdAt: now.toISOString(),
      });
      logger.debug(`Credits: new wallet ${wallet}`);
    }

    // Monthly reset
    if (now >= new Date(doc.resetDate)) {
      doc.usedThisMonth = 0;
      doc.resetDate = nextResetDate();
      if (doc.plan !== "free") {
        const topUp = PLAN_QUOTAS[doc.plan as CreditPlan];
        doc.balance += topUp;
        doc.history.push({
          action:    "signup",
          amount:    topUp,
          timestamp: now.toISOString(),
          note:      `Monthly ${doc.plan} plan top-up`,
        });
        if (doc.history.length > 100) doc.history = doc.history.slice(-100) as any;
      }
      await doc.save();
    }

    return toPlain(doc);
  },

  /**
   * Deduct credits for an action. Returns false if balance is insufficient.
   */
  async consumeCredits(wallet: string, action: CreditAction, count = 1): Promise<boolean> {
    const cost = CREDIT_COSTS[action] * count;
    const now = new Date().toISOString();

    // findOneAndUpdate with conditional deduct — atomic in MongoDB
    const doc = await CreditsModel.findOneAndUpdate(
      { wallet, balance: { $gte: cost } },
      {
        $inc: { balance: -cost, usedThisMonth: cost },
        $push: {
          history: {
            $each: [{ action, amount: -cost, timestamp: now }],
            $slice: -100,
          },
        },
      },
      { new: true }
    );

    if (!doc) return false; // insufficient balance or wallet not found
    return true;
  },

  /**
   * Award credits (signup bonus, plan purchase, etc.)
   */
  async awardCredits(wallet: string, amount: number, note: string): Promise<WalletCredits> {
    const now = new Date().toISOString();

    const doc = await CreditsModel.findOneAndUpdate(
      { wallet },
      {
        $inc: { balance: amount },
        $push: {
          history: {
            $each: [{ action: "signup", amount, timestamp: now, note }],
            $slice: -100,
          },
        },
      },
      { new: true, upsert: false }
    );

    if (!doc) throw new Error("Wallet not found — call getCredits first");
    return toPlain(doc);
  },

  /**
   * Upgrade a wallet to a new plan. Awards the credit difference immediately.
   * Sets expiresAt to 30 days from now for paid plans.
   */
  async setPlan(wallet: string, plan: CreditPlan): Promise<WalletCredits> {
    // Ensure wallet exists first
    let doc = await CreditsModel.findOne({ wallet });
    if (!doc) await this.getCredits(wallet); // creates it
    doc = await CreditsModel.findOne({ wallet });
    if (!doc) throw new Error("Failed to find/create wallet credits");

    const oldQuota = PLAN_QUOTAS[doc.plan as CreditPlan];
    const newQuota = PLAN_QUOTAS[plan];
    const bonus    = Math.max(0, newQuota - oldQuota);
    const now      = new Date().toISOString();
    const expiresAt = plan !== "free"
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    const updateOps: any = {
      $set: { plan, monthlyQuota: newQuota, expiresAt },
    };

    if (bonus > 0) {
      updateOps.$inc = { balance: bonus };
      updateOps.$push = {
        history: {
          $each: [{ action: "signup", amount: bonus, timestamp: now, note: `Upgraded to ${plan} plan` }],
          $slice: -100,
        },
      };
    }

    const updated = await CreditsModel.findOneAndUpdate({ wallet }, updateOps, { new: true });
    if (!updated) throw new Error("Failed to update plan");
    return toPlain(updated);
  },

  /**
   * Nightly cron: downgrade all wallets with expired paid plans to free.
   */
  async downgradeExpiredPlans(): Promise<void> {
    const now = new Date().toISOString();

    const result = await CreditsModel.updateMany(
      {
        plan:      { $ne: "free" },
        expiresAt: { $lte: now },
      },
      {
        $set: { plan: "free", monthlyQuota: PLAN_QUOTAS.free, expiresAt: undefined },
        $push: {
          history: {
            $each: [{
              action:    "signup",
              amount:    0,
              timestamp: now,
              note:      "Plan expired — downgraded to free",
            }],
            $slice: -100,
          },
        },
      }
    );

    if (result.modifiedCount > 0) {
      logger.info(`Downgraded ${result.modifiedCount} expired plan(s) to free`);
    }
  },

  /**
   * Returns available plans with pricing info.
   */
  getPlans() {
    return [
      {
        id:          "free" as CreditPlan,
        name:        "Free",
        credits:     PLAN_QUOTAS.free,
        priceUSDC:   PLAN_PRICES_USDC.free,
        priceXLM:    PLAN_PRICES_XLM.free,
        description: "100 credits/month — perfect for exploring",
        features:    ["100 credits/month", "5 yield queries", "Basic access"],
      },
      {
        id:          "basic" as CreditPlan,
        name:        "Basic",
        credits:     PLAN_QUOTAS.basic,
        priceUSDC:   PLAN_PRICES_USDC.basic,
        priceXLM:    PLAN_PRICES_XLM.basic,
        description: "500 credits/month — for active users",
        features:    ["500 credits/month", "100 yield queries", "Priority support"],
      },
      {
        id:          "pro" as CreditPlan,
        name:        "Pro",
        credits:     PLAN_QUOTAS.pro,
        priceUSDC:   PLAN_PRICES_USDC.pro,
        priceXLM:    PLAN_PRICES_XLM.pro,
        description: "2000 credits/month — for power users & builders",
        features:    ["2000 credits/month", "400 yield queries", "API access", "Priority support"],
      },
    ];
  },
};
