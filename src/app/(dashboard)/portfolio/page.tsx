"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { useWallet } from "@/hooks/useWallet";
import { usePortfolio } from "@/hooks/usePortfolio";
import {
  TrendingUp, Zap, Shield, AlertCircle, RefreshCw,
  Bot, ArrowUpRight, ArrowDownRight, BarChart3, Clock, ExternalLink,
} from "lucide-react";
import { TxLink } from "@/components/ui/TxLink";
import clsx from "clsx";
import Link from "next/link";

const PROTOCOL_COLORS: Record<string, string> = {
  blend: "bg-indigo-500",
  soroswap: "bg-purple-500",
  ondo: "bg-green-500",
  defindex: "bg-amber-500",
  aquarius: "bg-cyan-500",
  centrifuge: "bg-rose-500",
  idle: "bg-gray-500",
  other: "bg-gray-400",
};

const PROTOCOL_BG: Record<string, string> = {
  blend: "bg-indigo-600/20 text-indigo-300",
  soroswap: "bg-purple-600/20 text-purple-300",
  ondo: "bg-green-600/20 text-green-300",
  defindex: "bg-amber-600/20 text-amber-300",
  aquarius: "bg-cyan-600/20 text-cyan-300",
  centrifuge: "bg-rose-600/20 text-rose-300",
  idle: "bg-gray-600/20 text-gray-300",
  other: "bg-gray-600/20 text-gray-300",
};

export default function PortfolioPage() {
  const { address: wallet } = useWallet();
  const { data, loading, error, refresh, agentRebalance } = usePortfolio(wallet);
  const [rebalancing, setRebalancing] = useState(false);
  const [rebalanceResult, setRebalanceResult] = useState<any>(null);

  async function handleAgentRebalance() {
    setRebalancing(true);
    setRebalanceResult(null);
    try {
      const result = await agentRebalance();
      setRebalanceResult(result);
    } catch (err: any) {
      setRebalanceResult({ error: err.message });
    } finally {
      setRebalancing(false);
    }
  }

  if (!wallet) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="text-[var(--text-secondary)]">Track your deployed funds and earnings</p>
        </div>
        <Card>
          <div className="flex items-center gap-3 text-[var(--text-secondary)]">
            <AlertCircle className="w-5 h-5" />
            <p>Connect Freighter wallet to view your portfolio.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="text-[var(--text-secondary)]">Your deployed funds, APY, and earnings</p>
        </div>
        <button
          onClick={refresh}
          className="text-[var(--text-secondary)] hover:text-white transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}
      {error && (
        <Card>
          <p className="text-red-400 text-sm">{error}</p>
        </Card>
      )}

      {data && (
        <>
          {/* Top stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card glow className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600/20 rounded-lg">
                  <Shield className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">Vault Balance</p>
                  <p className="text-xl font-bold">${data.vaultBalance}</p>
                  <p className="text-xs text-[var(--text-secondary)]">USDC</p>
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-600/20 rounded-lg">
                  <Zap className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">Weighted APY</p>
                  <p className="text-xl font-bold text-amber-400">{data.weightedApy}%</p>
                  <p className="text-xs text-[var(--text-secondary)]">on deployed</p>
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="flex items-center gap-3">
                <div className="p-2.5 bg-green-600/20 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">Earned so far</p>
                  <p className="text-xl font-bold text-green-400">+${parseFloat(data.pnl.earnedUsdc).toFixed(4)}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{data.pnl.daysDeployed} days</p>
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-600/20 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">Monthly return</p>
                  <p className="text-xl font-bold">${data.projectedMonthlyReturn}</p>
                  <p className="text-xs text-[var(--text-secondary)]">${data.projectedYearlyReturn}/yr</p>
                </div>
              </Card>
            </motion.div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Position Breakdown */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card>
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-400" />
                  Deployed Positions
                </h3>

                {data.deployedPositions.length === 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-[var(--text-secondary)]">
                      No positions deployed yet. Your ${data.vaultBalance} USDC is idle in the vault.
                    </p>
                    <Link href="/chat">
                      <Button size="sm" className="w-full">Ask Agent for Strategy</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Allocation bar */}
                    <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                      {data.deployedPositions.map((pos, i) => (
                        <div
                          key={i}
                          className={clsx("h-full transition-all", PROTOCOL_COLORS[pos.protocolKey] || "bg-gray-400")}
                          style={{ width: `${pos.allocationPct}%` }}
                          title={`${pos.protocol}: ${pos.allocationPct}%`}
                        />
                      ))}
                      {parseFloat(data.idleInVault) > 0 && (
                        <div
                          className="h-full bg-gray-600 opacity-50"
                          style={{ width: `${(parseFloat(data.idleInVault) / parseFloat(data.vaultBalance)) * 100}%` }}
                          title="Idle in vault"
                        />
                      )}
                    </div>

                    {/* Position rows */}
                    {data.deployedPositions.map((pos, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className={clsx("w-2.5 h-2.5 rounded-full", PROTOCOL_COLORS[pos.protocolKey])} />
                            <span className="font-medium">{pos.protocol}</span>
                            <span className={clsx("text-xs px-1.5 py-0.5 rounded-full", PROTOCOL_BG[pos.protocolKey] || "bg-gray-600/20 text-gray-300")}>
                              {pos.allocationPct}%
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-medium">${pos.amountUsdc.toFixed(2)}</span>
                            <span className="text-amber-400 ml-2 text-xs font-medium">{pos.currentApy.toFixed(1)}% APY</span>
                          </div>
                        </div>
                        {/* Progress bar showing utilization of this position */}
                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={clsx("h-full rounded-full", PROTOCOL_COLORS[pos.protocolKey])}
                            style={{ width: `${pos.allocationPct}%` }}
                          />
                        </div>
                      </div>
                    ))}

                    {parseFloat(data.idleInVault) > 0.01 && (
                      <div className="flex items-center justify-between text-sm text-[var(--text-secondary)] border-t border-[var(--border)] pt-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                          <span>Idle in Vault</span>
                        </div>
                        <span>${parseFloat(data.idleInVault).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </motion.div>

            {/* Agent Rebalance + Stats */}
            <div className="space-y-4">
              {/* Autonomous Agent Card */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card className="border-indigo-500/30">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-indigo-400" />
                    Autonomous Agent
                  </h3>
                  <div className="space-y-3">
                    {/* Autonomous status pill */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-xs text-green-400 font-medium">Running autonomously every 5 min</span>
                    </div>

                    {/* x402 mode badge */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                      <Zap className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="text-xs text-indigo-300">
                        Agent pays <span className="font-mono font-medium">0.01 USDC</span> via x402 per rebalance check — buying AI intelligence from your vault
                      </span>
                    </div>

                    <div className="text-sm text-[var(--text-secondary)]">
                      The agent autonomously queries the AI optimizer (paid via x402) and rebalances when APY can improve ≥0.5%. No action needed.
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
                      <div className="flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3" />
                        <span>{data.rebalanceCount} rebalance{data.rebalanceCount !== 1 ? "s" : ""} done</span>
                      </div>
                      {data.lastRebalance && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          <span>Last: {new Date(data.lastRebalance).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Manual trigger (force check) */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={handleAgentRebalance}
                      disabled={rebalancing || data.deployedPositions.length === 0}
                    >
                      {rebalancing ? (
                        <><Spinner className="mr-2" />Checking now...</>
                      ) : (
                        <><RefreshCw className="mr-2 w-3 h-3" />Force check now</>
                      )}
                    </Button>

                    {rebalanceResult && (
                      <div className={clsx(
                        "rounded-lg p-3 text-sm",
                        rebalanceResult.error ? "bg-red-500/10 text-red-400" :
                        rebalanceResult.rebalanced ? "bg-green-500/10 text-green-400" :
                        "bg-white/5 text-[var(--text-secondary)]"
                      )}>
                        {rebalanceResult.error ? (
                          rebalanceResult.error
                        ) : rebalanceResult.rebalanced ? (
                          <>
                            <p className="font-medium">Rebalanced!</p>
                            <p>{rebalanceResult.fromApy}% → {rebalanceResult.toApy}% APY (+{rebalanceResult.apyImprovement}%)</p>
                          </>
                        ) : (
                          <p>{rebalanceResult.reason}</p>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>

              {/* Current Market Rates */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Live Market Rates
                  </h3>
                  <div className="space-y-2">
                    {[
                      { key: "blend",    label: "Blend USDC",  color: "text-indigo-400" },
                      { key: "soroswap", label: "Soroswap LP", color: "text-purple-400" },
                    ].map(({ key, label, color }) => (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span className="text-[var(--text-secondary)]">{label}</span>
                        <span className={clsx("font-medium", color)}>
                          {(data.currentRates[key] ?? 0).toFixed(1)}% APY
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            </div>
          </div>

          {/* Rebalance History */}
          {data.rebalanceHistory.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <Card>
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-green-400" />
                  Rebalance History
                </h3>
                <div className="space-y-2">
                  {data.rebalanceHistory.map((event, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <Badge variant={event.type === "auto_rebalance" ? "info" : "default"} className="text-xs shrink-0">
                            {event.type === "auto_rebalance" ? "Auto" : "Manual"}
                          </Badge>
                          {event.type === "auto_rebalance" && (
                            <Badge variant="success" className="text-xs shrink-0">x402</Badge>
                          )}
                          <span className="text-[var(--text-secondary)] text-xs truncate">{event.reason}</span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                          {new Date(event.timestamp).toLocaleString()}
                          {event.txCount > 0 && (
                            <span className="ml-2 text-indigo-400">· {event.txCount} tx</span>
                          )}
                        </p>
                      </div>
                      <div className={clsx(
                        "flex items-center gap-1 text-sm font-medium",
                        event.netApyChange >= 0 ? "text-green-400" : "text-red-400"
                      )}>
                        {event.netApyChange >= 0
                          ? <ArrowUpRight className="w-4 h-4" />
                          : <ArrowDownRight className="w-4 h-4" />
                        }
                        {event.netApyChange >= 0 ? "+" : ""}{event.netApyChange.toFixed(2)}% APY
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Quick actions */}
          <div className="grid gap-4 md:grid-cols-2">
            <Link href="/chat">
              <Card className="flex items-center gap-3 hover:border-indigo-500/50 transition-colors cursor-pointer">
                <div className="p-2.5 bg-indigo-600/20 rounded-lg">
                  <Bot className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="font-medium">Ask Agent</p>
                  <p className="text-xs text-[var(--text-secondary)]">Get a new strategy or check your status</p>
                </div>
              </Card>
            </Link>
            <Link href="/vault">
              <Card className="flex items-center gap-3 hover:border-indigo-500/50 transition-colors cursor-pointer">
                <div className="p-2.5 bg-purple-600/20 rounded-lg">
                  <Shield className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="font-medium">Manage Vault</p>
                  <p className="text-xs text-[var(--text-secondary)]">Deposit, withdraw, manage agents</p>
                </div>
              </Card>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
