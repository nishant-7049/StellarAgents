"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { useWallet } from "@/hooks/useWallet";
import { useCredits } from "@/hooks/useCredits";
import { Zap, CheckCircle2, TrendingUp, Star } from "lucide-react";
import clsx from "clsx";

const PLAN_COLORS: Record<string, string> = {
  free: "border-[var(--border)]",
  basic: "border-indigo-500/60",
  pro: "border-amber-500/60",
};

const PLAN_BADGE: Record<string, "default" | "success" | "warning"> = {
  free: "default",
  basic: "success",
  pro: "warning",
};

export default function CreditsPage() {
  const { address: publicKey } = useWallet();
  const { credits, plans, loading, purchasePlan, refresh } = useCredits(publicKey);
  const [selectedToken, setSelectedToken] = useState<"USDC" | "XLM">("USDC");
  const [purchasing, setPurchasing] = useState<string | null>(null);

  async function handlePurchase(planId: string) {
    if (!publicKey) return;
    setPurchasing(planId);
    try {
      // In a real impl this would open Freighter to sign a payment tx
      // For demo, simulate with a mock txHash
      const mockTxHash = `demo_${Date.now()}_${planId}`;
      await purchasePlan(planId, mockTxHash, selectedToken);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPurchasing(null);
    }
  }

  const usagePct = credits && credits.monthlyQuota > 0
    ? Math.min(100, (credits.usedThisMonth / credits.monthlyQuota) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Credits & Plans</h1>
        <p className="text-[var(--text-secondary)]">Manage your API credits and subscription plan</p>
      </div>

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
          {/* Current Usage */}
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
                  Resets: {new Date(credits.resetDate).toLocaleDateString()}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Credit Costs Reference */}
          <Card>
            <h3 className="font-semibold mb-3">Credit Costs</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { action: "Yield query", cost: 5 },
                { action: "Execute strategy tx", cost: 2 },
                { action: "Create vault", cost: 10 },
                { action: "Register agent", cost: 20 },
              ].map(item => (
                <div key={item.action} className="flex justify-between py-1 border-b border-[var(--border)]">
                  <span className="text-[var(--text-secondary)]">{item.action}</span>
                  <span className="text-amber-400 font-medium">{item.cost} credits</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent History */}
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
          {/* Token selector */}
          <div className="flex gap-1 bg-white/5 rounded-lg p-1">
            {(["USDC", "XLM"] as const).map(token => (
              <button
                key={token}
                onClick={() => setSelectedToken(token)}
                className={clsx(
                  "px-3 py-1 rounded text-sm font-medium transition-all",
                  selectedToken === token
                    ? "bg-indigo-600 text-white"
                    : "text-[var(--text-secondary)] hover:text-white"
                )}
              >
                {token}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
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

                  <div className="text-3xl font-bold mb-1">
                    {plan.priceUSDC === 0 ? (
                      <span className="text-green-400">Free</span>
                    ) : (
                      <>
                        {selectedToken === "USDC" ? `$${plan.priceUSDC}` : `${plan.priceXLM} XLM`}
                        <span className="text-base text-[var(--text-secondary)] font-normal">/mo</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-amber-400 mb-4">
                    <Zap className="w-4 h-4" />
                    <span className="font-semibold">{plan.credits.toLocaleString()} credits/mo</span>
                  </div>

                  <ul className="space-y-2">
                    {plan.features.map(feature => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span className="text-[var(--text-secondary)]">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-5 pt-0">
                  {credits?.plan === plan.id ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : plan.priceUSDC === 0 ? (
                    <Button variant="outline" className="w-full" disabled>
                      Default
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => handlePurchase(plan.id)}
                      disabled={!!purchasing || !publicKey}
                    >
                      {purchasing === plan.id ? (
                        <><Spinner className="mr-2" />Processing...</>
                      ) : (
                        <><TrendingUp className="mr-2 w-4 h-4" />Upgrade</>
                      )}
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
