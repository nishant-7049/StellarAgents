/**
 * Platform Credit System (SaaS Monetization)
 *
 * In-memory store with JSON file persistence.
 * Each wallet address gets credits on signup and consumes them per action.
 *
 * Credit costs:
 *   signup          → 100 free credits
 *   create vault    → 10 credits
 *   register agent  → 20 credits
 *   yield query     → 5 credits
 *   execute tx      → 2 credits per tx
 *
 * Plans:
 *   free  → 100/mo  ($0)
 *   basic → 500/mo  ($5, paid in XLM or USDC)
 *   pro   → 2000/mo ($15)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { logger } from "../logger.js";

export type CreditAction =
  | "signup"
  | "create_vault"
  | "register_agent"
  | "yield_query"
  | "execute_tx";

export type CreditPlan = "free" | "basic" | "pro";

export interface CreditHistoryEntry {
  action: CreditAction;
  amount: number; // negative = debit, positive = credit
  timestamp: string;
  note?: string;
}

export interface WalletCredits {
  wallet: string;
  balance: number;
  plan: CreditPlan;
  monthlyQuota: number;
  usedThisMonth: number;
  resetDate: string; // ISO date of next monthly reset
  history: CreditHistoryEntry[];
  createdAt: string;
}

export const CREDIT_COSTS: Record<CreditAction, number> = {
  signup: 0,          // award, not cost
  create_vault: 10,
  register_agent: 20,
  yield_query: 5,
  execute_tx: 2,
};

export const PLAN_QUOTAS: Record<CreditPlan, number> = {
  free: 100,
  basic: 500,
  pro: 2000,
};

export const PLAN_PRICES_USDC: Record<CreditPlan, number> = {
  free: 0,
  basic: 5,
  pro: 15,
};

// XLM prices (approximate at 0.10 USD/XLM)
export const PLAN_PRICES_XLM: Record<CreditPlan, number> = {
  free: 0,
  basic: 50,   // $5 / $0.10 per XLM
  pro: 150,    // $15 / $0.10 per XLM
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const CREDITS_FILE = path.join(DATA_DIR, "credits.json");

// In-memory store
const store = new Map<string, WalletCredits>();

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadFromDisk() {
  try {
    ensureDataDir();
    if (!existsSync(CREDITS_FILE)) return;
    const raw = readFileSync(CREDITS_FILE, "utf-8");
    const data = JSON.parse(raw) as Record<string, WalletCredits>;
    for (const [wallet, credits] of Object.entries(data)) {
      store.set(wallet, credits);
    }
    logger.debug(`Credits: loaded ${store.size} wallets from disk`);
  } catch (err) {
    logger.warn("Could not load credits from disk", { err });
  }
}

function saveToDisk() {
  try {
    ensureDataDir();
    const data: Record<string, WalletCredits> = {};
    for (const [wallet, credits] of store.entries()) {
      data[wallet] = credits;
    }
    writeFileSync(CREDITS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    logger.warn("Could not save credits to disk", { err });
  }
}

// Load on startup
loadFromDisk();

function nextResetDate(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toISOString();
}

function getOrCreate(wallet: string): WalletCredits {
  if (!store.has(wallet)) {
    const initial: WalletCredits = {
      wallet,
      balance: 100,
      plan: "free",
      monthlyQuota: PLAN_QUOTAS.free,
      usedThisMonth: 0,
      resetDate: nextResetDate(),
      history: [
        {
          action: "signup",
          amount: 100,
          timestamp: new Date().toISOString(),
          note: "Welcome bonus",
        },
      ],
      createdAt: new Date().toISOString(),
    };
    store.set(wallet, initial);
    saveToDisk();
  }
  return store.get(wallet)!;
}

function applyMonthlyReset(credits: WalletCredits): WalletCredits {
  const now = new Date();
  const reset = new Date(credits.resetDate);
  if (now >= reset) {
    credits.usedThisMonth = 0;
    credits.resetDate = nextResetDate();
    // Monthly top-up for paid plans
    if (credits.plan !== "free") {
      const topUp = PLAN_QUOTAS[credits.plan];
      credits.balance += topUp;
      credits.history.push({
        action: "signup",
        amount: topUp,
        timestamp: now.toISOString(),
        note: `Monthly ${credits.plan} plan top-up`,
      });
    }
  }
  return credits;
}

export const creditsService = {
  getCredits(wallet: string): WalletCredits {
    const credits = getOrCreate(wallet);
    applyMonthlyReset(credits);
    saveToDisk();
    return credits;
  },

  /**
   * Deduct credits for an action. Returns false if insufficient balance.
   */
  consumeCredits(wallet: string, action: CreditAction, count = 1): boolean {
    const credits = getOrCreate(wallet);
    applyMonthlyReset(credits);

    const cost = CREDIT_COSTS[action] * count;
    if (credits.balance < cost) {
      return false;
    }

    credits.balance -= cost;
    credits.usedThisMonth += cost;
    credits.history.push({
      action,
      amount: -cost,
      timestamp: new Date().toISOString(),
    });

    // Keep history trimmed to last 100 entries
    if (credits.history.length > 100) {
      credits.history = credits.history.slice(-100);
    }

    store.set(wallet, credits);
    saveToDisk();
    return true;
  },

  /**
   * Award credits (signup bonus, plan purchase, etc.)
   */
  awardCredits(wallet: string, amount: number, note: string): WalletCredits {
    const credits = getOrCreate(wallet);
    credits.balance += amount;
    credits.history.push({
      action: "signup",
      amount,
      timestamp: new Date().toISOString(),
      note,
    });
    store.set(wallet, credits);
    saveToDisk();
    return credits;
  },

  /**
   * Upgrade wallet to a plan. Awards difference in quota immediately.
   */
  setPlan(wallet: string, plan: CreditPlan): WalletCredits {
    const credits = getOrCreate(wallet);
    const oldQuota = PLAN_QUOTAS[credits.plan];
    const newQuota = PLAN_QUOTAS[plan];
    const bonus = Math.max(0, newQuota - oldQuota);

    credits.plan = plan;
    credits.monthlyQuota = newQuota;
    if (bonus > 0) {
      credits.balance += bonus;
      credits.history.push({
        action: "signup",
        amount: bonus,
        timestamp: new Date().toISOString(),
        note: `Upgraded to ${plan} plan`,
      });
    }

    store.set(wallet, credits);
    saveToDisk();
    return credits;
  },

  /**
   * Returns available plans with pricing info.
   */
  getPlans() {
    return [
      {
        id: "free" as CreditPlan,
        name: "Free",
        credits: PLAN_QUOTAS.free,
        priceUSDC: PLAN_PRICES_USDC.free,
        priceXLM: PLAN_PRICES_XLM.free,
        description: "100 credits/month — perfect for exploring",
        features: ["100 credits/month", "5 yield queries", "Basic access"],
      },
      {
        id: "basic" as CreditPlan,
        name: "Basic",
        credits: PLAN_QUOTAS.basic,
        priceUSDC: PLAN_PRICES_USDC.basic,
        priceXLM: PLAN_PRICES_XLM.basic,
        description: "500 credits/month — for active users",
        features: ["500 credits/month", "100 yield queries", "Priority support"],
      },
      {
        id: "pro" as CreditPlan,
        name: "Pro",
        credits: PLAN_QUOTAS.pro,
        priceUSDC: PLAN_PRICES_USDC.pro,
        priceXLM: PLAN_PRICES_XLM.pro,
        description: "2000 credits/month — for power users & builders",
        features: ["2000 credits/month", "400 yield queries", "API access", "Priority support"],
      },
    ];
  },
};
