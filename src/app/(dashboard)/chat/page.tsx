"use client";
import { useState, useEffect } from "react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { fetchAPI } from "@/lib/api";
import { TxLink } from "@/components/ui/TxLink";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import {
  Bot, Shield, TrendingUp, Zap, RefreshCw, Activity,
  ExternalLink, Package, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import clsx from "clsx";
import { DEMO_VAULT_ADDRESS } from "@/lib/contracts";

// Agent #20 "defi-agent" — live rebalancing agent; portfolio is looked up by vault address
const DEMO_AGENT_ID = 20;
const STELLAR_EXPERT = "https://stellar.expert/explorer/public/account";

const PROTOCOL_COLORS: Record<string, string> = {
  blend:      "bg-indigo-500",
  soroswap:   "bg-purple-500",
  ondo:       "bg-green-500",
  defindex:   "bg-amber-500",
  aquarius:   "bg-cyan-500",
  centrifuge: "bg-rose-500",
  idle:       "bg-gray-400",
  other:      "bg-gray-400",
};

const PROTOCOL_APY_COLORS: Record<string, string> = {
  blend:      "text-indigo-400",
  soroswap:   "text-purple-400",
  ondo:       "text-green-400",
  defindex:   "text-amber-400",
  aquarius:   "text-cyan-400",
  centrifuge: "text-rose-400",
};

interface AgentProfile {
  id: number;
  name: string;
  handle: string | null;
  owner: string;
  isActive: boolean;
  capabilities: string[];
  pricing: { amount: string; protocol: string } | null;
  model: string | null;
}

const SDK_PACKAGES = [
  { name: "@agenticocean/defi-agent",    label: "defi-agent",    desc: "AI yield optimizer toolkit",  docsUrl: "https://agenticoceandocs.vercel.app/#/sdk/defi-agent/overview" },
  { name: "@agenticocean/vault",         label: "vault",         desc: "Vault + agent identity SDK",  docsUrl: "https://agenticoceandocs.vercel.app/#/sdk/vault/overview" },
  { name: "@agenticocean/x402-stellar",  label: "x402-stellar",  desc: "x402 payment middleware",     docsUrl: "https://agenticoceandocs.vercel.app/#/sdk/x402-stellar/overview" },
];

export default function AgentDemoPage() {
  const { data: portfolio, loading: portfolioLoading, refresh } = usePortfolio(DEMO_VAULT_ADDRESS || null);
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [agentLoading, setAgentLoading] = useState(true);

  useEffect(() => {
    fetchAPI<AgentProfile>(`/api/explorer/agents/${DEMO_AGENT_ID}`)
      .then(d => setAgent(d))
      .catch(() => setAgent(null))
      .finally(() => setAgentLoading(false));
  }, []);

  const rates = portfolio?.currentRates ?? {};

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live Agent Demo</h1>
          <p className="text-[var(--text-secondary)]">
            Live performance of our autonomous AI yield optimizer on Stellar mainnet
          </p>
        </div>
        <button
          onClick={refresh}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mt-1"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Agent identity card */}
      <Card className="flex flex-col sm:flex-row sm:items-center gap-4">
        {agentLoading ? (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[10px] skeleton flex-shrink-0" />
            <div className="space-y-2">
              <div className="h-4 w-40 rounded skeleton" />
              <div className="h-3 w-28 rounded skeleton" />
            </div>
          </div>
        ) : agent ? (
          <>
            {/* Avatar + identity */}
            <div className="flex items-center gap-4 flex-1">
              <div
                className="w-12 h-12 rounded-[10px] flex items-center justify-center text-lg font-bold flex-shrink-0"
                style={{ background: "#DDEAFF", color: "#0B1220" }}
              >
                {agent.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-lg text-[var(--text-primary)]">{agent.name}</h2>
                  {agent.handle && (
                    <span className="text-sm text-[var(--accent)] font-mono">@{agent.handle}</span>
                  )}
                  <span className={clsx(
                    "inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full font-medium",
                    agent.isActive
                      ? "bg-green-500/15 text-green-500"
                      : "bg-gray-500/15 text-gray-400"
                  )}>
                    <span className={clsx("w-1.5 h-1.5 rounded-full", agent.isActive ? "bg-green-500 animate-pulse" : "bg-gray-400")} />
                    {agent.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {agent.pricing && (
                    <span className="text-sm text-[var(--success)] font-medium">
                      {(parseInt(agent.pricing.amount) / 1e7).toFixed(3)} USDC / query
                    </span>
                  )}
                  {agent.model && (
                    <span className="text-xs text-[var(--text-muted)] font-mono">{agent.model}</span>
                  )}
                  <a
                    href={`${STELLAR_EXPERT}/${agent.owner}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-[var(--text-muted)] font-mono hover:text-[var(--accent)] transition-colors"
                  >
                    {agent.owner.slice(0, 6)}…{agent.owner.slice(-4)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Capabilities */}
            {agent.capabilities.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {agent.capabilities.map(cap => (
                  <span key={cap}
                    className="text-[11px] px-2.5 py-1 rounded-[6px]
                      bg-[var(--surface1)] border border-[var(--border)] text-[var(--text-secondary)]">
                    {cap}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-3 text-[var(--text-muted)]">
            <Bot className="w-5 h-5" />
            <span>Agent not found</span>
          </div>
        )}
      </Card>

      {/* Stats row */}
      {portfolioLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl skeleton" />)}
        </div>
      ) : portfolio ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="flex items-center gap-3 p-4">
            <div className="p-2 bg-indigo-600/20 rounded-lg flex-shrink-0">
              <Shield className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Vault Balance</p>
              <p className="text-xl font-bold">${portfolio.vaultBalance}</p>
              <p className="text-xs text-[var(--text-muted)]">USDC</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <div className="p-2 bg-amber-600/20 rounded-lg flex-shrink-0">
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Weighted APY</p>
              <p className="text-xl font-bold text-amber-400">{portfolio.weightedApy}%</p>
              <p className="text-xs text-[var(--text-muted)]">on deployed</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <div className="p-2 bg-purple-600/20 rounded-lg flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Deployed</p>
              <p className="text-xl font-bold">${portfolio.totalDeployed}</p>
              <p className="text-xs text-[var(--text-muted)]">USDC active</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <div className="p-2 bg-green-600/20 rounded-lg flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Earned</p>
              <p className="text-xl font-bold text-green-400">+${parseFloat(portfolio.pnl.earnedUsdc).toFixed(4)}</p>
              <p className="text-xs text-[var(--text-muted)]">{portfolio.pnl.daysDeployed}d deployed</p>
            </div>
          </Card>
        </div>
      ) : null}

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Protocol allocations */}
        <Card>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            Deployed Protocols
          </h3>
          {portfolioLoading ? (
            <div className="space-y-3">
              <div className="h-3 w-full rounded-full skeleton" />
              {[0,1,2].map(i => <div key={i} className="h-8 rounded skeleton" />)}
            </div>
          ) : portfolio && portfolio.deployedPositions.length > 0 ? (
            <div className="space-y-4">
              {/* Stacked bar */}
              <div className="flex h-3 rounded-full overflow-hidden gap-px">
                {portfolio.deployedPositions.map((pos, i) => (
                  <div
                    key={i}
                    className={clsx("h-full transition-all", PROTOCOL_COLORS[pos.protocolKey] ?? "bg-gray-400")}
                    style={{ width: `${pos.allocationPct}%` }}
                    title={`${pos.protocol}: ${pos.allocationPct}%`}
                  />
                ))}
                {parseFloat(portfolio.idleInVault) > 0 && parseFloat(portfolio.vaultBalance) > 0 && (
                  <div
                    className="h-full bg-gray-400 opacity-30"
                    style={{ width: `${(parseFloat(portfolio.idleInVault) / parseFloat(portfolio.vaultBalance)) * 100}%` }}
                    title="Idle"
                  />
                )}
              </div>

              {/* Rows */}
              <div className="space-y-3">
                {portfolio.deployedPositions.map((pos, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={clsx("w-2.5 h-2.5 rounded-full", PROTOCOL_COLORS[pos.protocolKey] ?? "bg-gray-400")} />
                        <span className="font-medium">{pos.protocol}</span>
                        <span className="text-xs text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--surface1)]">
                          {pos.allocationPct}%
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">${pos.amountUsdc.toFixed(2)}</span>
                        <span className={clsx("ml-2 text-xs font-semibold", PROTOCOL_APY_COLORS[pos.protocolKey] ?? "text-gray-400")}>
                          {pos.currentApy.toFixed(1)}% APY
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-[var(--surface1)] rounded-full overflow-hidden">
                      <div
                        className={clsx("h-full rounded-full", PROTOCOL_COLORS[pos.protocolKey] ?? "bg-gray-400")}
                        style={{ width: `${pos.allocationPct}%` }}
                      />
                    </div>
                  </div>
                ))}
                {parseFloat(portfolio.idleInVault) > 0.01 && (
                  <div className="flex items-center justify-between text-sm text-[var(--text-muted)] pt-1 border-t border-[var(--border)]">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                      <span>Idle in Vault</span>
                    </div>
                    <span>${parseFloat(portfolio.idleInVault).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          ) : portfolio ? (
            <p className="text-sm text-[var(--text-muted)]">No positions deployed yet.</p>
          ) : null}
        </Card>

        {/* Right column */}
        <div className="space-y-6">
          {/* Live market rates */}
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Live Protocol Rates
            </h3>
            {portfolioLoading ? (
              <div className="space-y-2">
                {[0,1,2,3].map(i => <div key={i} className="h-6 rounded skeleton" />)}
              </div>
            ) : (
              <div className="space-y-2.5">
                {[
                  { key: "blend",    label: "Blend USDC",  color: "text-indigo-400" },
                  { key: "soroswap", label: "Soroswap LP", color: "text-purple-400" },
                ].map(({ key, label, color }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={clsx("w-2 h-2 rounded-full", PROTOCOL_COLORS[key] ?? "bg-gray-400")} />
                      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
                    </div>
                    <span className={clsx("text-sm font-semibold tabular-nums", color)}>
                      {((rates[key] ?? 0) as number).toFixed(1)}% APY
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Rebalance stats */}
          {portfolio && (
            <Card>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-green-400" />
                Autonomous Activity
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-[var(--surface1)] px-3 py-2.5 text-center">
                  <p className="text-2xl font-bold">{portfolio.rebalanceCount}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Rebalances done</p>
                </div>
                <div className="rounded-lg bg-[var(--surface1)] px-3 py-2.5 text-center">
                  <p className="text-2xl font-bold">${portfolio.projectedMonthlyReturn}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Proj. monthly return</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                <span className="text-xs text-green-400 font-medium">Rebalancing every 5 min via x402</span>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Recent actions */}
      {!portfolioLoading && portfolio && portfolio.rebalanceHistory.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            Recent Agent Actions
          </h3>
          <div className="space-y-2">
            {portfolio.rebalanceHistory.slice(0, 8).map((event: any, i: number) => (
              <div key={i}
                className="flex items-center justify-between gap-4 py-2.5 border-b border-[var(--border)] last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={clsx(
                      "text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0",
                      event.type === "auto_rebalance"
                        ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                        : "bg-gray-500/15 text-gray-400"
                    )}>
                      {event.type === "auto_rebalance" ? "Auto Rebalance" : "Manual"}
                    </span>
                    <span className="text-sm text-[var(--text-secondary)] truncate">{event.reason}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-[var(--text-muted)]">
                      {new Date(event.timestamp).toLocaleString("en-US", {
                        month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    {event.txHashes?.length > 0 && (
                      <TxLink hash={event.txHashes[0]} className="text-xs" />
                    )}
                  </div>
                </div>
                <div className={clsx(
                  "flex items-center gap-1 text-sm font-semibold shrink-0",
                  event.netApyChange >= 0 ? "text-green-400" : "text-red-400"
                )}>
                  {event.netApyChange >= 0
                    ? <ArrowUpRight className="w-4 h-4" />
                    : <ArrowDownRight className="w-4 h-4" />}
                  {event.netApyChange >= 0 ? "+" : ""}{event.netApyChange.toFixed(2)}% APY
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Build your own SDK CTA */}
      <Card className="border-[var(--accent)]/20 bg-gradient-to-br from-[var(--accent)]/5 to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <Package className="w-4 h-4 text-[var(--accent)]" />
              <h3 className="font-semibold text-[var(--text-primary)]">Build your own AI agent</h3>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Our open-source SDKs make it easy to ship a Stellar AI agent with your own yield strategy,
              custom logic, and autonomous x402 payments — in minutes.
            </p>
            <div className="rounded-[8px] bg-[var(--surface1)] border border-[var(--border)] px-3 py-2 font-mono text-[12px] text-[var(--text-secondary)] select-all inline-block">
              <span className="text-[var(--text-muted)]">$</span> npm install @agenticocean/defi-agent
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:w-64 shrink-0">
            {SDK_PACKAGES.map(pkg => (
              <a
                key={pkg.name}
                href={pkg.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 rounded-[8px] px-3 py-2.5
                  bg-[var(--surface1)] border border-[var(--border)]
                  hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5
                  transition-colors group"
              >
                <div>
                  <p className="text-[12px] font-mono font-medium text-[var(--accent)] group-hover:underline">
                    {pkg.label}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">{pkg.desc}</p>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
