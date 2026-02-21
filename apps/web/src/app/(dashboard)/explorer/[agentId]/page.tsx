"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { fetchAPI } from "@/lib/api";
import { shortenAddress, getTxUrl } from "@/lib/stellar";
import {
  ArrowLeft, Bot, Star, Zap, ExternalLink, Shield,
  Activity, Hash, TrendingUp, DollarSign, Calendar,
  BarChart3, AtSign, Globe, Cpu,
} from "lucide-react";

interface AgentDetail {
  id: number;
  owner: string;
  name: string;
  handle: string | null;
  agentUri: string;
  vaultAddress: string;
  agentSigner: string;
  registeredAt: number;
  isActive: boolean;
  capabilities: string[];
  pricing: any;
  model: string | null;
  endpoints: any;
  reputation: { totalReviews: number; totalScore: number; avgScore: number } | null;
  feedback: any[];
  paymentHistory: any[];
}

interface AgentStats {
  isMock: boolean;
  totals: {
    queries: number;
    usdcSpent: number;
    daysActive: number;
    avgDailyQueries: number;
  };
  daily: { date: string; queries: number; usdcSpent: number }[];
  actions: { action: string; count: number }[];
}

const ACTION_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6",
];

function formatDate(d: string) {
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

function formatAction(a: string) {
  return a.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a2e] border border-[var(--border)] rounded-lg px-3 py-2 text-xs">
      <p className="text-[var(--text-secondary)] mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-medium">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function AgentProfilePage() {
  const { agentId } = useParams();
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId) return;
    Promise.all([
      fetchAPI<AgentDetail>(`/api/explorer/agents/${agentId}`),
      fetchAPI<AgentStats>(`/api/explorer/agents/${agentId}/stats`),
    ])
      .then(([agentData, statsData]) => {
        setAgent(agentData);
        setStats(statsData);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [agentId]);

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error || !agent) {
    return (
      <Card>
        <p className="text-red-400">{error || "Agent not found"}</p>
        <Link href="/explorer" className="text-indigo-400 hover:underline mt-2 block">← Back</Link>
      </Card>
    );
  }

  const registeredDate = agent.registeredAt
    ? new Date(Number(agent.registeredAt) * 1000).toLocaleDateString()
    : "Unknown";

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/explorer" className="text-[var(--text-secondary)] hover:text-white mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{agent.name}</h1>
            <Badge variant="default">#{agent.id}</Badge>
            {agent.isActive
              ? <Badge variant="success">Active</Badge>
              : <Badge variant="error">Inactive</Badge>}
            {stats?.isMock && (
              <Badge variant="info" className="text-xs">Demo data</Badge>
            )}
          </div>
          {agent.handle && (
            <div className="flex items-center gap-1.5 mt-1">
              <AtSign className="w-4 h-4 text-indigo-400" />
              <span className="text-indigo-400 font-mono text-sm font-medium">
                {agent.handle}
              </span>
              <span className="text-xs text-[var(--text-secondary)]">· Unique on-chain handle</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[
            { icon: <Hash className="w-4 h-4 text-indigo-400" />, label: "Total Queries", value: stats.totals.queries.toLocaleString(), color: "bg-indigo-600/20" },
            { icon: <DollarSign className="w-4 h-4 text-green-400" />, label: "USDC Paid", value: `$${stats.totals.usdcSpent.toFixed(3)}`, color: "bg-green-600/20" },
            { icon: <Calendar className="w-4 h-4 text-amber-400" />, label: "Days Active", value: stats.totals.daysActive, color: "bg-amber-600/20" },
            { icon: <TrendingUp className="w-4 h-4 text-purple-400" />, label: "Avg / Day", value: stats.totals.avgDailyQueries, color: "bg-purple-600/20" },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${s.color}`}>{s.icon}</div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">{s.label}</p>
                  <p className="text-lg font-bold">{s.value}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Charts Row */}
      {stats && (
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Daily Queries Bar Chart */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                Daily Queries — Last 30 Days
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={stats.daily} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                    interval={6}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="queries" name="Queries" fill="#6366f1" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* USDC Spent Area Chart */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card>
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-green-400" />
                USDC Spent via x402 — Last 30 Days
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={stats.daily} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="usdcGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                    interval={6}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="usdcSpent"
                    name="USDC"
                    stroke="#10b981"
                    fill="url(#usdcGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Action Breakdown */}
      {stats && stats.actions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4 text-amber-400" />
              Action Breakdown
            </h3>
            <div className="space-y-2.5">
              {stats.actions.map((a, i) => {
                const pct = Math.round((a.count / stats.totals.queries) * 100);
                return (
                  <div key={a.action} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--text-secondary)]">{formatAction(a.action)}</span>
                      <span className="font-medium">{a.count} <span className="text-[var(--text-secondary)]">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: ACTION_COLORS[i % ACTION_COLORS.length] }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: 0.35 + i * 0.05 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Details + Reputation + History */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Left: Identity + Capabilities */}
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <Card glow>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Bot className="w-4 h-4 text-indigo-400" />
                Identity
              </h3>
              <div className="space-y-3 text-sm">
                {agent.handle && (
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-secondary)] flex items-center gap-1">
                      <AtSign className="w-3 h-3" /> Handle
                    </span>
                    <span className="font-mono text-indigo-400">@{agent.handle}</span>
                  </div>
                )}
                <Row label="Agent ID" value={`#${agent.id}`} />
                <Row label="Owner" value={shortenAddress(agent.owner, 8)} mono link={`https://stellar.expert/explorer/testnet/account/${agent.owner}`} />
                <Row label="Vault" value={shortenAddress(agent.vaultAddress, 8)} mono link={`https://stellar.expert/explorer/testnet/contract/${agent.vaultAddress}`} />
                <Row label="Signer" value={shortenAddress(agent.agentSigner, 8)} mono />
                <Row label="Registered" value={registeredDate} />
                {agent.model && (
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-secondary)] flex items-center gap-1">
                      <Cpu className="w-3 h-3" /> Model
                    </span>
                    <span className="text-xs font-mono bg-white/5 px-2 py-0.5 rounded">{agent.model}</span>
                  </div>
                )}
                {agent.endpoints?.query && (
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-secondary)] flex items-center gap-1">
                      <Globe className="w-3 h-3" /> Endpoint
                    </span>
                    <a href={agent.endpoints.query} target="_blank" rel="noopener noreferrer"
                       className="text-xs text-indigo-400 hover:underline truncate max-w-[180px]">
                      {agent.endpoints.query.replace("https://", "")}
                    </a>
                  </div>
                )}
              </div>

              {/* Capabilities */}
              {agent.capabilities.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-[var(--text-secondary)] mb-2">Capabilities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.capabilities.map(cap => (
                      <span key={cap} className="text-xs bg-indigo-600/20 text-indigo-300 px-2 py-1 rounded-full">
                        {cap.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Pricing */}
              {agent.pricing && (
                <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <Zap className="w-4 h-4 text-green-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-400">
                      {parseInt(agent.pricing.amount || "100000") / 10_000_000} USDC per query
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Paid via {agent.pricing.protocol || "x402"} · {agent.pricing.asset || "USDC"} on Stellar
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>

          {/* Reputation */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" />
                Reputation
              </h3>
              {agent.reputation ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="text-4xl font-bold text-amber-400">
                      {agent.reputation.avgScore.toFixed(1)}
                    </div>
                    <div>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star key={star} className={`w-4 h-4 ${star <= agent.reputation!.avgScore
                            ? "text-amber-400 fill-amber-400"
                            : "text-[var(--border)]"}`} />
                        ))}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">
                        {agent.reputation.totalReviews} review{agent.reputation.totalReviews !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  {/* Score bar */}
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${(agent.reputation.avgScore / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">No reviews yet</p>
              )}

              {agent.feedback.length > 0 && (
                <div className="mt-4 space-y-2">
                  {agent.feedback.slice(0, 3).map((fb: any, i: number) => (
                    <div key={i} className="border-t border-[var(--border)] pt-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-3 h-3 text-indigo-400" />
                        <span className="text-xs text-[var(--text-secondary)]">
                          {shortenAddress(fb.reviewer || "", 6)}
                        </span>
                        <div className="flex gap-0.5 ml-auto">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} className={`w-3 h-3 ${s <= fb.score ? "text-amber-400 fill-amber-400" : "text-[var(--border)]"}`} />
                          ))}
                        </div>
                      </div>
                      {fb.category && (
                        <Badge variant="default" className="text-xs">{fb.category}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        </div>

        {/* Right: Transaction History */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="h-fit">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-400" />
              Transaction History
            </h3>
            {agent.paymentHistory.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">No transactions yet.</p>
            ) : (
              <div className="space-y-0">
                {agent.paymentHistory.slice(0, 12).map((item: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
                    {/* Icon */}
                    <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${
                      item.type === "payment" ? "bg-green-600/20" :
                      item.type === "agent" ? "bg-indigo-600/20" :
                      item.type === "vault" ? "bg-amber-600/20" :
                      "bg-white/5"
                    }`}>
                      {item.type === "payment" ? <Zap className="w-3 h-3 text-green-400" /> :
                       item.type === "agent" ? <Bot className="w-3 h-3 text-indigo-400" /> :
                       item.type === "vault" ? <Shield className="w-3 h-3 text-amber-400" /> :
                       <Activity className="w-3 h-3 text-[var(--text-secondary)]" />}
                    </div>

                    {/* Description */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">{item.description}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                    </div>

                    {/* Amount + Link */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.amountFormatted && (
                        <Badge variant="success" className="text-xs whitespace-nowrap">
                          {item.amountFormatted}
                        </Badge>
                      )}
                      {item.txHash && !item.txHash.startsWith("ledger-") && (
                        <a
                          href={getTxUrl(item.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

function Row({
  label, value, mono, link,
}: { label: string; value: string; mono?: boolean; link?: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[var(--text-secondary)]">{label}</span>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer"
           className={`text-indigo-400 hover:underline ${mono ? "font-mono text-xs" : ""}`}>
          {value}
        </a>
      ) : (
        <span className={mono ? "font-mono text-xs" : ""}>{value}</span>
      )}
    </div>
  );
}
