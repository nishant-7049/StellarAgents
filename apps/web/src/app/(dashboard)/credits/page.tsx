"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { useWallet } from "@/hooks/useWallet";
import { useCredits } from "@/hooks/useCredits";
import { buildPaymentTx, submitPaymentTx } from "@/lib/stellar";
import { signTransaction } from "@/lib/freighter";
import {
  Zap, CheckCircle2, TrendingUp, Star, X,
  CreditCard, Wallet, AlertTriangle, ExternalLink,
} from "lucide-react";
import clsx from "clsx";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

const PLAN_COLORS: Record<string, string> = {
  free:  "border-[var(--border)]",
  basic: "border-indigo-500/60",
  pro:   "border-amber-500/60",
};

const PLAN_BADGE: Record<string, "default" | "success" | "warning"> = {
  free:  "default",
  basic: "success",
  pro:   "warning",
};

type PaymentMethod = "CARD" | "USDC";

interface PaymentParams {
  facilitatorAddress: string;
  usdcIssuer: string;
  network: string;
}

export default function CreditsPage() {
  const { address: publicKey } = useWallet();
  const { credits, plans, loading, purchasePlan, refresh } = useCredits(publicKey);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("USDC");
  const [confirmPlanId, setConfirmPlanId] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [successTx, setSuccessTx] = useState<string | null>(null);      // txHash or "stripe"
  const [payError, setPayError] = useState<string | null>(null);

  // Handle Stripe redirect back (?success=true or ?canceled=true)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      setSuccessTx("stripe");
      refresh();
      window.history.replaceState({}, "", "/credits");
    }
    if (params.get("canceled") === "true") {
      setPayError("Payment canceled.");
      window.history.replaceState({}, "", "/credits");
    }
  }, [refresh]);

  // ── Usage calculations ─────────────────────────────────────────────
  const usagePct = credits && credits.monthlyQuota > 0
    ? Math.min(100, (credits.usedThisMonth / credits.monthlyQuota) * 100)
    : 0;

  const expiryInfo = useCallback(() => {
    if (!credits?.expiresAt || credits.plan === "free") return null;
    const now = new Date();
    const exp = new Date(credits.expiresAt);
    const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { days, expired: days <= 0, near: days > 0 && days <= 7, date: exp };
  }, [credits])();

  // ── Payment flows ──────────────────────────────────────────────────

  function handleUpgradeClick(planId: string) {
    setPayError(null);
    setSuccessTx(null);
    if (paymentMethod === "CARD") {
      executeStripeCheckout(planId);
    } else {
      setConfirmPlanId(planId);
    }
  }

  async function executeStripeCheckout(planId: string) {
    if (!publicKey) return;
    setPurchasing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/credits/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey, plan: planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Stripe checkout failed");
      window.location.href = data.url;
    } catch (err: any) {
      setPayError(err.message);
      setPurchasing(false);
    }
  }

  async function executeFreighterPayment(planId: string) {
    if (!publicKey) return;
    setPurchasing(true);
    setConfirmPlanId(null);
    setPayError(null);

    try {
      // 1. Get facilitator params
      const paramsRes = await fetch(`${BACKEND_URL}/api/credits/payment-params`);
      const params: PaymentParams = await paramsRes.json();
      if (!params.facilitatorAddress) throw new Error("Could not get payment destination");

      const plan = plans.find(p => p.id === planId);
      if (!plan) throw new Error("Plan not found");

      // 2. Build payment amount
      const amount = plan.priceUSDC.toFixed(7);
      const asset = { code: "USDC", issuer: params.usdcIssuer };

      // 3. Build classic Stellar payment tx
      const unsignedXdr = await buildPaymentTx({
        from: publicKey,
        to: params.facilitatorAddress,
        asset,
        amount,
        memo: `plan_${planId}`,
      });

      // 4. Sign with Freighter
      const signedXdr = await signTransaction(unsignedXdr);

      // 5. Submit to Horizon
      const txHash = await submitPaymentTx(signedXdr);

      // 6. Verify on backend → upgrade plan
      await purchasePlan(planId, txHash);

      setSuccessTx(txHash);
      await refresh();
    } catch (err: any) {
      setPayError(err.message || "Payment failed");
    } finally {
      setPurchasing(false);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────
  const confirmPlan = plans.find(p => p.id === confirmPlanId);

  function planButtonLabel(planId: string) {
    if (paymentMethod === "CARD") return "Pay with Card";
    const plan = plans.find(p => p.id === planId);
    if (!plan) return "Upgrade";
    return `Pay $${plan.priceUSDC} USDC`;
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Credits & Plans</h1>
        <p className="text-[var(--text-secondary)]">Manage your API credits and subscription plan</p>
      </div>

      {/* Success banner */}
      <AnimatePresence>
        {successTx && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 bg-green-500/15 border border-green-500/40 rounded-lg p-4"
          >
            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-green-300">Plan upgraded successfully!</p>
              {successTx !== "stripe" ? (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${successTx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-400/80 hover:underline inline-flex items-center gap-1"
                >
                  View transaction on Stellar Expert <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <p className="text-sm text-green-400/80">Payment confirmed via Stripe</p>
              )}
            </div>
            <button onClick={() => setSuccessTx(null)} className="text-green-400/60 hover:text-green-400">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error banner */}
      <AnimatePresence>
        {payError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 bg-red-500/15 border border-red-500/40 rounded-lg p-4"
          >
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="flex-1 text-sm text-red-300">{payError}</p>
            <button onClick={() => setPayError(null)} className="text-red-400/60 hover:text-red-400">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!publicKey && (
        <Card>
          <p className="text-[var(--text-secondary)]">Connect your wallet to view and manage credits.</p>
        </Card>
      )}

      {publicKey && loading && (
        <div className="flex justify-center py-8"><Spinner /></div>
      )}

      {publicKey && credits && (
        <>
          {/* Current Balance */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card glow className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <h3 className="font-semibold">Current Balance</h3>
                </div>
                <Badge variant={PLAN_BADGE[credits.plan]}>{credits.plan.toUpperCase()}</Badge>
              </div>

              <div className="text-4xl font-bold text-amber-400 mb-2">
                {credits.balance.toLocaleString()}
                <span className="text-lg text-[var(--text-secondary)] ml-2">credits</span>
              </div>

              {/* Plan expiry */}
              {expiryInfo && (
                <div className={clsx(
                  "text-xs mb-3 flex items-center gap-1",
                  expiryInfo.expired ? "text-red-400" :
                  expiryInfo.near   ? "text-amber-400" :
                  "text-[var(--text-secondary)]"
                )}>
                  {(expiryInfo.expired || expiryInfo.near) && <AlertTriangle className="w-3 h-3" />}
                  {expiryInfo.expired
                    ? "Plan expired — please renew below"
                    : expiryInfo.near
                    ? `Expires in ${expiryInfo.days} day${expiryInfo.days === 1 ? "" : "s"}`
                    : `Renews ${expiryInfo.date.toLocaleDateString()}`}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">Monthly usage</span>
                  <span>{credits.usedThisMonth} / {credits.monthlyQuota}</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={clsx(
                      "h-full rounded-full transition-all",
                      usagePct > 80 ? "bg-red-500" : usagePct > 50 ? "bg-amber-500" : "bg-indigo-500"
                    )}
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  Resets {new Date(credits.resetDate).toLocaleDateString()}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Credit Costs */}
          <Card>
            <h3 className="font-semibold mb-3">Credit Costs</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { action: "Yield query",       cost: 5  },
                { action: "Execute strategy",  cost: 2  },
                { action: "Create vault",       cost: 10 },
                { action: "Register agent",     cost: 20 },
              ].map(item => (
                <div key={item.action} className="flex justify-between py-1 border-b border-[var(--border)]">
                  <span className="text-[var(--text-secondary)]">{item.action}</span>
                  <span className="text-amber-400 font-medium">{item.cost} cr</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent Activity */}
          {credits.history.length > 0 && (
            <Card>
              <h3 className="font-semibold mb-3">Recent Activity</h3>
              <div className="space-y-1">
                {[...credits.history].reverse().slice(0, 8).map((entry, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
                    <div>
                      <span className="text-sm capitalize">{entry.action.replace(/_/g, " ")}</span>
                      {entry.note && <span className="text-xs text-[var(--text-secondary)] ml-2">— {entry.note}</span>}
                    </div>
                    <span className={clsx("text-sm font-mono font-medium", entry.amount > 0 ? "text-green-400" : "text-red-400")}>
                      {entry.amount > 0 ? "+" : ""}{entry.amount}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Plans */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Upgrade Plan</h2>

          {/* Payment method selector */}
          <div className="flex gap-1 bg-white/5 rounded-lg p-1">
            {([
              { id: "CARD" as PaymentMethod, icon: <CreditCard className="w-3.5 h-3.5" />, label: "Card" },
              { id: "USDC" as PaymentMethod, icon: <span className="text-xs font-bold">$</span>,  label: "USDC" },
            ] as const).map(opt => (
              <button
                key={opt.id}
                onClick={() => setPaymentMethod(opt.id)}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all",
                  paymentMethod === opt.id
                    ? "bg-indigo-600 text-white"
                    : "text-[var(--text-secondary)] hover:text-white"
                )}
              >
                {opt.icon}{opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Payment method hint */}
        <p className="text-xs text-[var(--text-secondary)] mb-4">
          {paymentMethod === "CARD" && "Pay with any credit/debit card via Stripe."}
          {paymentMethod === "USDC" && "Pay with USDC on Stellar Testnet via Freighter."}
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Card
                glow={plan.id === "pro"}
                className={clsx(
                  "relative flex flex-col h-full border",
                  PLAN_COLORS[plan.id],
                  credits?.plan === plan.id && "ring-2 ring-indigo-500"
                )}
              >
                {plan.id === "pro" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="warning" className="flex items-center gap-1">
                      <Star className="w-3 h-3" /> Most Popular
                    </Badge>
                  </div>
                )}

                <div className="p-5 flex-1">
                  <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">{plan.description}</p>

                  {/* Price display */}
                  <div className="text-3xl font-bold mb-1">
                    {plan.priceUSDC === 0 ? (
                      <span className="text-green-400">Free</span>
                    ) : (
                      <>${plan.priceUSDC}<span className="text-base text-[var(--text-secondary)] font-normal">/mo</span></>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-amber-400 mb-4">
                    <Zap className="w-4 h-4" />
                    <span className="font-semibold">{plan.credits.toLocaleString()} credits/mo</span>
                  </div>

                  <ul className="space-y-2">
                    {plan.features.map(feature => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                        <span className="text-[var(--text-secondary)]">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-5 pt-0">
                  {credits?.plan === plan.id ? (
                    <Button variant="outline" className="w-full" disabled>Current Plan</Button>
                  ) : plan.priceUSDC === 0 ? (
                    <Button variant="outline" className="w-full" disabled>Default</Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => handleUpgradeClick(plan.id)}
                      disabled={purchasing || !publicKey}
                    >
                      {purchasing ? (
                        <><Spinner className="mr-2" />Processing...</>
                      ) : paymentMethod === "CARD" ? (
                        <><CreditCard className="mr-2 w-4 h-4" />{planButtonLabel(plan.id)}</>
                      ) : (
                        <><TrendingUp className="mr-2 w-4 h-4" />{planButtonLabel(plan.id)}</>
                      )}
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Freighter confirmation modal */}
      <AnimatePresence>
        {confirmPlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setConfirmPlanId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm"
            >
              <Card className="p-6">
                <h3 className="text-lg font-bold mb-1">Confirm Payment</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-5">
                  Freighter will open for you to sign the transaction.
                </p>

                <div className="space-y-3 mb-6 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Plan</span>
                    <span className="font-semibold capitalize">{confirmPlan.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Amount</span>
                    <span className="font-semibold">{confirmPlan.priceUSDC} USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Network</span>
                    <span>Stellar Testnet</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Valid for</span>
                    <span>30 days</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setConfirmPlanId(null)}
                    disabled={purchasing}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => executeFreighterPayment(confirmPlan.id)}
                    disabled={purchasing}
                  >
                    {purchasing
                      ? <><Spinner className="mr-2" />Signing...</>
                      : <><Wallet className="mr-2 w-4 h-4" />Sign & Pay</>}
                  </Button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
