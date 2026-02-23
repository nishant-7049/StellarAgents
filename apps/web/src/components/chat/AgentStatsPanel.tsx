"use client";
import { useState, useEffect } from "react";
import { Bot, Zap, TrendingUp, Shield, ExternalLink, RefreshCw, Activity, Package, ArrowUpRight } from "lucide-react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { fetchAPI } from "@/lib/api";
import { TxLink } from "@/components/ui/TxLink";
import clsx from "clsx";

// Agent #20 "defi-agent" — our live rebalancing agent on testnet
const DEMO_WALLET = "GDLCSUDUCBLY5Z727TAZ4ZLUTKYM2CC74FM77M3GJ7IA2BYEQRD6CRZ6";
const DEMO_AGENT_ID = 20;
const STELLAR_EXPERT_ADDR = "https://stellar.expert/explorer/public/account";

const PROTOCOL_COLORS: Record<string, string> = {
  blend:       "bg-indigo-500",
  soroswap:    "bg-purple-500",
  ondo:        "bg-green-500",
  defindex:    "bg-amber-500",
  aquarius:    "bg-cyan-500",
  centrifuge:  "bg-rose-500",
  idle:        "bg-gray-400",
  other:       "bg-gray-400",
};

const PROTOCOL_LABEL_COLORS: Record<string, string> = {
  blend:      "text-indigo-400",
  soroswap:   "text-purple-400",
  ondo:       "text-green-400",
  defindex:   "text-amber-400",
  aquarius:   "text-cyan-400",
  centrifuge: "text-rose-400",
  idle:       "text-gray-400",
  other:      "text-gray-400",
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
  vaultAddress: string;
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-[var(--border)] last:border-b-0">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[var(--text-muted)]">{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("rounded skeleton", className)} />;
}

export function AgentStatsPanel() {
  const { data: portfolio, loading: portfolioLoading, refresh } = usePortfolio(DEMO_WALLET);
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
    <div className="flex flex-col h-full overflow-y-auto text-[13px]">
      {/* SDK Banner */}
      <div className="px-4 py-3.5 border-b border-[var(--border)] bg-gradient-to-br from-[var(--accent)]/8 to-transparent">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="font-semibold text-[var(--text-primary)] text-[13px] leading-snug">Build your own AI agent</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
              Use our open-source SDKs to ship a Stellar AI agent with custom yield strategies.
            </p>
          </div>
          <Package className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-0.5" />
        </div>

        {/* Install snippet */}
        <div className="rounded-[8px] bg-[var(--surface1)] border border-[var(--border)] px-3 py-2 mb-2.5 font-mono text-[10px] text-[var(--text-secondary)] leading-relaxed select-all">
          <span className="text-[var(--text-muted)]">$</span> npm install @agenticocean/defi-agent
        </div>

        {/* Package pills */}
        <div className="flex flex-col gap-1.5">
          {[
            { label: "x402-stellar", desc: "Payment middleware",     docsUrl: "https://agenticoceandocs.vercel.app/#/sdk/x402-stellar/overview" },
            { label: "vault",        desc: "Vault + agent identity", docsUrl: "https://agenticoceandocs.vercel.app/#/sdk/vault/overview" },
            { label: "defi-agent",   desc: "AI yield toolkit",       docsUrl: "https://agenticoceandocs.vercel.app/#/sdk/defi-agent/overview" },
          ].map(pkg => (
            <a
              key={pkg.label}
              href={pkg.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 rounded-[7px] px-2.5 py-1.5
                bg-[var(--surface1)] border border-[var(--border)]
                hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 transition-colors group"
            >
              <div className="min-w-0">
                <span className="text-[11px] font-mono font-medium text-[var(--accent)] group-hover:underline truncate block">
                  {pkg.label}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">{pkg.desc}</span>
              </div>
              <ArrowUpRight className="w-3 h-3 text-[var(--text-muted)] group-hover:text-[var(--accent)] flex-shrink-0 transition-colors" />
            </a>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-[var(--accent)]" />
          <span className="font-semibold text-[var(--text-primary)]">Agent Stats</span>
        </div>
        <button
          onClick={refresh}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Agent Profile */}
      <Section title="Agent Profile" icon={<Bot className="w-3.5 h-3.5" />}>
        {agentLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
            <div className="flex gap-1 mt-2">
              <Skeleton className="h-5 w-16 rounded-[5px]" />
              <Skeleton className="h-5 w-16 rounded-[5px]" />
            </div>
          </div>
        ) : agent ? (
          <div className="space-y-2">
            {/* Name row */}
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[13px] font-semibold flex-shrink-0"
                style={{ background: "#DDEAFF", color: "#0B1220" }}
              >
                {agent.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[var(--text-primary)] truncate">{agent.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {agent.handle && (
                    <span className="text-[11px] text-[var(--accent)] font-mono">@{agent.handle}</span>
                  )}
                  <span className={clsx(
                    "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                    agent.isActive
                      ? "bg-green-500/15 text-green-500"
                      : "bg-gray-500/15 text-gray-400"
                  )}>
                    <span className={clsx("w-1.5 h-1.5 rounded-full", agent.isActive ? "bg-green-500 animate-pulse" : "bg-gray-400")} />
                    {agent.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>

            {/* Capabilities */}
            {agent.capabilities.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {agent.capabilities.slice(0, 4).map(cap => (
                  <span key={cap}
                    className="text-[10px] px-2 py-0.5 rounded-[5px] bg-[var(--surface1)] border border-[var(--border)] text-[var(--text-secondary)]">
                    {cap}
                  </span>
                ))}
                {agent.capabilities.length > 4 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-[5px] bg-[var(--surface1)] border border-[var(--border)] text-[var(--text-muted)]">
                    +{agent.capabilities.length - 4}
                  </span>
                )}
              </div>
            )}

            {/* Pricing + Owner */}
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-0.5">
              {agent.pricing && (
                <span className="text-[var(--success)] font-medium">
                  {(parseInt(agent.pricing.amount) / 1e7).toFixed(3)} USDC / query
                </span>
              )}
              <a
                href={`${STELLAR_EXPERT_ADDR}/${agent.owner}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-0.5 font-mono hover:text-[var(--accent)] transition-colors"
              >
                {agent.owner.slice(0, 4)}…{agent.owner.slice(-4)}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        ) : (
          <p className="text-[var(--text-muted)] text-[12px]">No agent found</p>
        )}
      </Section>

      {/* Portfolio Summary */}
      <Section title="Vault Overview" icon={<Shield className="w-3.5 h-3.5" />}>
        {portfolioLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[0,1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        ) : portfolio ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-[var(--surface1)] px-3 py-2">
              <p className="text-[10px] text-[var(--text-muted)]">Vault Balance</p>
              <p className="font-semibold text-[var(--text-primary)]">${portfolio.vaultBalance}</p>
              <p className="text-[10px] text-[var(--text-muted)]">USDC</p>
            </div>
            <div className="rounded-lg bg-[var(--surface1)] px-3 py-2">
              <p className="text-[10px] text-[var(--text-muted)]">Weighted APY</p>
              <p className="font-semibold text-amber-400">{portfolio.weightedApy}%</p>
              <p className="text-[10px] text-[var(--text-muted)]">on deployed</p>
            </div>
            <div className="rounded-lg bg-[var(--surface1)] px-3 py-2">
              <p className="text-[10px] text-[var(--text-muted)]">Deployed</p>
              <p className="font-semibold text-[var(--text-primary)]">${portfolio.totalDeployed}</p>
              <p className="text-[10px] text-[var(--text-muted)]">USDC</p>
            </div>
            <div className="rounded-lg bg-[var(--surface1)] px-3 py-2">
              <p className="text-[10px] text-[var(--text-muted)]">Earned</p>
              <p className="font-semibold text-green-400">+${parseFloat(portfolio.pnl.earnedUsdc).toFixed(4)}</p>
              <p className="text-[10px] text-[var(--text-muted)]">{portfolio.pnl.daysDeployed}d</p>
            </div>
          </div>
        ) : (
          <p className="text-[var(--text-muted)] text-[12px]">No vault data</p>
        )}
      </Section>

      {/* Protocol Allocations */}
      <Section title="Deployed Protocols" icon={<TrendingUp className="w-3.5 h-3.5" />}>
        {portfolioLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-full rounded-full" />
            <Skeleton className="h-8 w-full rounded" />
            <Skeleton className="h-8 w-full rounded" />
          </div>
        ) : portfolio && portfolio.deployedPositions.length > 0 ? (
          <div className="space-y-2.5">
            {/* Allocation bar */}
            <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
              {portfolio.deployedPositions.map((pos, i) => (
                <div
                  key={i}
                  className={clsx("h-full", PROTOCOL_COLORS[pos.protocolKey] ?? "bg-gray-400")}
                  style={{ width: `${pos.allocationPct}%` }}
                  title={`${pos.protocol}: ${pos.allocationPct}%`}
                />
              ))}
              {parseFloat(portfolio.idleInVault) > 0 && parseFloat(portfolio.vaultBalance) > 0 && (
                <div
                  className="h-full bg-gray-300 opacity-40"
                  style={{ width: `${(parseFloat(portfolio.idleInVault) / parseFloat(portfolio.vaultBalance)) * 100}%` }}
                  title="Idle"
                />
              )}
            </div>

            {/* Position rows */}
            {portfolio.deployedPositions.map((pos, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className={clsx("w-2 h-2 rounded-full flex-shrink-0", PROTOCOL_COLORS[pos.protocolKey] ?? "bg-gray-400")} />
                  <span className="text-[var(--text-secondary)] truncate">{pos.protocol}</span>
                  <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">{pos.allocationPct}%</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-[var(--text-primary)] font-medium">${pos.amountUsdc.toFixed(2)}</span>
                  <span className={clsx("ml-1.5 text-[11px] font-medium", PROTOCOL_LABEL_COLORS[pos.protocolKey] ?? "text-gray-400")}>
                    {pos.currentApy.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}

            {parseFloat(portfolio.idleInVault) > 0.01 && (
              <div className="flex items-center justify-between gap-2 text-[var(--text-muted)]">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" />
                  <span>Idle</span>
                </div>
                <span>${parseFloat(portfolio.idleInVault).toFixed(2)}</span>
              </div>
            )}
          </div>
        ) : portfolio ? (
          <p className="text-[var(--text-muted)] text-[12px]">No deployed positions yet.</p>
        ) : null}
      </Section>

      {/* Live APYs */}
      <Section title="Live Protocol Rates" icon={<Zap className="w-3.5 h-3.5" />}>
        {portfolioLoading ? (
          <div className="space-y-1.5">
            {[0,1,2,3].map(i => <Skeleton key={i} className="h-5 w-full rounded" />)}
          </div>
        ) : (
          <div className="space-y-1.5">
            {[
              { key: "blend",    label: "Blend USDC",  color: "text-indigo-400" },
              { key: "soroswap", label: "Soroswap LP", color: "text-purple-400" },
            ].map(({ key, label, color }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">{label}</span>
                <span className={clsx("font-medium tabular-nums", color)}>
                  {((rates[key] ?? 0) as number).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Recent Actions */}
      <Section title="Recent Actions" icon={<Activity className="w-3.5 h-3.5" />}>
        {portfolioLoading ? (
          <div className="space-y-2">
            {[0,1,2].map(i => <Skeleton key={i} className="h-10 w-full rounded" />)}
          </div>
        ) : portfolio && portfolio.rebalanceHistory.length > 0 ? (
          <div className="space-y-2">
            {portfolio.rebalanceHistory.slice(0, 5).map((event: any, i: number) => (
              <div key={i} className="rounded-lg bg-[var(--surface1)] px-2.5 py-2 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className={clsx(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                    event.type === "auto_rebalance"
                      ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                      : "bg-gray-500/15 text-gray-400"
                  )}>
                    {event.type === "auto_rebalance" ? "Auto Rebalance" : "Manual"}
                  </span>
                  <span className={clsx(
                    "text-[11px] font-medium tabular-nums",
                    event.netApyChange >= 0 ? "text-green-400" : "text-red-400"
                  )}>
                    {event.netApyChange >= 0 ? "+" : ""}{event.netApyChange.toFixed(2)}% APY
                  </span>
                </div>
                <p className="text-[10px] text-[var(--text-muted)] truncate">{event.reason}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {new Date(event.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {event.txHashes?.length > 0 && (
                    <TxLink hash={event.txHashes[0]} className="text-[10px]" />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : portfolio ? (
          <p className="text-[var(--text-muted)] text-[12px]">No rebalance history yet.</p>
        ) : null}

        {/* x402 Payment actions */}
        {portfolio && (portfolio as any).x402Payments?.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">x402 Payments</p>
            {((portfolio as any).x402Payments as any[]).slice(0, 3).map((pay: any, i: number) => (
              <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-[var(--text-muted)] truncate">{pay.service ?? "AI Query"}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[var(--text-secondary)] tabular-nums">
                    {pay.amountUsdc ? `${parseFloat(pay.amountUsdc).toFixed(4)} USDC` : "—"}
                  </span>
                  {pay.txHash && <TxLink hash={pay.txHash} className="text-[10px]" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
