"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { useWallet } from "@/hooks/useWallet";
import { fetchAPI } from "@/lib/api";
import { shortenAddress, getTxUrl } from "@/lib/stellar";
import { Shield, Bot, Zap, TrendingUp, ExternalLink, AlertCircle } from "lucide-react";
import { CreditMeter } from "@/components/dashboard/CreditMeter";

interface DashboardData {
  walletAddress: string;
  vault: {
    address: string | null;
    balance: string;
    balanceFormatted: string;
    totalSpent: string;
    totalSpentFormatted: string;
  };
  agent: { id: number; name: string; isActive: boolean } | null;
  authorizedAgents: Array<{
    address: string;
    name: string;
    dailyLimit: string;
    spentToday: string;
    isActive: boolean;
    remainingLimit: string;
  }>;
  credits: {
    balance: number;
    plan: string;
    usedThisMonth: number;
    monthlyQuota: number;
    resetDate: string;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    amount?: string;
    timestamp: string;
    txHash: string;
  }>;
}

export default function DashboardPage() {
  const { address: publicKey } = useWallet();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey) return;
    setLoading(true);
    fetchAPI<DashboardData>(`/api/dashboard/${publicKey}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [publicKey]);

  if (!publicKey) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-[var(--text-secondary)]">Connect your wallet to view your activity</p>
        </div>
        <Card>
          <div className="flex items-center gap-3 text-[var(--text-secondary)]">
            <AlertCircle className="w-5 h-5" />
            <p>Connect Freighter wallet to see your vault, agents, and credits.</p>
          </div>
        </Card>
        <div className="grid gap-4 md:grid-cols-3">
          <QuickAction href="/vault" icon={Shield} label="Create Vault" desc="Deploy your smart vault" color="indigo" />
          <QuickAction href="/chat" icon={Bot} label="Query Agent" desc="AI yield optimization" color="purple" />
          <QuickAction href="/register" icon={TrendingUp} label="Register Agent" desc="List your AI agent" color="amber" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-[var(--text-secondary)]">{shortenAddress(publicKey, 8)}</p>
      </div>

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}

      {data && (
        <>
          {/* Stats Row */}
          <div className="grid gap-4 md:grid-cols-3">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card glow className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600/20 rounded-lg">
                  <Shield className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">Vault Balance</p>
                  {data.vault.address ? (
                    <p className="text-xl font-bold">{data.vault.balanceFormatted} USDC</p>
                  ) : (
                    <Link href="/vault">
                      <Button variant="outline" size="sm" className="mt-1">Create Vault</Button>
                    </Link>
                  )}
                  {data.vault.address && (
                    <p className="text-xs text-[var(--text-secondary)]">Spent: {data.vault.totalSpentFormatted} USDC</p>
                  )}
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card className="flex items-center gap-4">
                <div className="p-3 bg-purple-600/20 rounded-lg">
                  <Bot className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">My Agent</p>
                  {data.agent ? (
                    <>
                      <p className="text-base font-semibold truncate max-w-[140px]">{data.agent.name}</p>
                      <Badge variant={data.agent.isActive ? "success" : "error"} className="text-xs">
                        {data.agent.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </>
                  ) : (
                    <Link href="/register">
                      <Button variant="outline" size="sm" className="mt-1">Register Agent</Button>
                    </Link>
                  )}
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="flex items-center gap-4">
                <div className="p-3 bg-amber-600/20 rounded-lg">
                  <Zap className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--text-secondary)]">Credits</p>
                  <p className="text-xl font-bold text-amber-400">{data.credits.balance.toLocaleString()}</p>
                  <p className="text-xs text-[var(--text-secondary)] capitalize">{data.credits.plan} plan</p>
                </div>
              </Card>
            </motion.div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Authorized Agents */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card>
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-400" />
                  Authorized Agents
                </h3>
                {data.authorizedAgents.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">
                    No agents authorized. <Link href="/vault" className="text-indigo-400 hover:underline">Add agents</Link> from your vault.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.authorizedAgents.map(agent => {
                      const spentPct = Number(agent.dailyLimit) > 0
                        ? Math.min(100, (Number(agent.spentToday) / Number(agent.dailyLimit)) * 100)
                        : 0;
                      const dailyLimitFormatted = (Number(agent.dailyLimit) / 10_000_000).toFixed(2);
                      const spentFormatted = (Number(agent.spentToday) / 10_000_000).toFixed(2);
                      return (
                        <div key={agent.address}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{agent.name}</span>
                            <span className="text-[var(--text-secondary)]">
                              {spentFormatted} / {dailyLimitFormatted} USDC
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${spentPct > 80 ? "bg-red-500" : "bg-indigo-500"}`}
                              style={{ width: `${spentPct}%` }}
                            />
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                            {shortenAddress(agent.address, 6)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </motion.div>

            {/* Recent Activity */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card>
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  Recent Activity
                </h3>
                {data.recentActivity.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">
                    No activity yet. Create a vault and query an agent.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.recentActivity.slice(0, 6).map((item, i) => (
                      <div key={`${item.txHash}-${i}`} className="flex items-start justify-between py-1.5 border-b border-[var(--border)] last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{item.description}</p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {new Date(item.timestamp).toLocaleString()}
                          </p>
                        </div>
                        {item.txHash && (
                          <a
                            href={getTxUrl(item.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-indigo-400 hover:text-indigo-300 flex-shrink-0"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>
          </div>

          {/* Quick Actions */}
          <div className="grid gap-4 md:grid-cols-3">
            <QuickAction href="/vault" icon={Shield} label="Manage Vault" desc="Deposit, withdraw, agents" color="indigo" />
            <QuickAction href="/chat" icon={Bot} label="Query Agent" desc="AI yield optimization" color="purple" />
            <QuickAction href="/credits" icon={Zap} label="Buy Credits" desc={`${data.credits.balance} remaining`} color="amber" />
          </div>
        </>
      )}

      {!loading && !data && publicKey && (
        <div className="grid gap-4 md:grid-cols-3">
          <QuickAction href="/vault" icon={Shield} label="Create Vault" desc="Deploy your smart vault" color="indigo" />
          <QuickAction href="/chat" icon={Bot} label="Query Agent" desc="AI yield optimization" color="purple" />
          <QuickAction href="/register" icon={TrendingUp} label="Register Agent" desc="List your AI agent" color="amber" />
        </div>
      )}
    </div>
  );
}

function QuickAction({ href, icon: Icon, label, desc, color }: {
  href: string;
  icon: any;
  label: string;
  desc: string;
  color: "indigo" | "purple" | "amber";
}) {
  const colors = {
    indigo: "bg-indigo-600/20 text-indigo-400",
    purple: "bg-purple-600/20 text-purple-400",
    amber: "bg-amber-600/20 text-amber-400",
  };
  return (
    <Link href={href}>
      <Card className="flex items-center gap-4 hover:border-indigo-500/50 transition-colors cursor-pointer">
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-xs text-[var(--text-secondary)]">{desc}</p>
        </div>
      </Card>
    </Link>
  );
}
