import Link from "next/link";
import { TrendingUp, DollarSign, ArrowRight } from "lucide-react";
import type { TrendingAgent } from "@/hooks/useExplorer";

interface CardProps {
  agent: TrendingAgent | null;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  calls: number;
  users: number;
  fees: number;
}

function TrendingCard({ agent, label, Icon, calls, users, fees }: CardProps) {
  if (!agent) {
    return (
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface0)] p-5">
        <div className="flex items-center gap-1.5 mb-3">
          <Icon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">{label}</span>
        </div>
        <p className="text-[13px] text-[var(--text-muted)]">No data available yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface0)]
      hover:bg-[var(--surface1)] hover:border-[var(--accent)]/20
      transition-colors duration-150 p-5">

      {/* Label */}
      <div className="flex items-center gap-1.5 mb-3">
        <Icon className="w-3.5 h-3.5 text-[var(--accent)]" />
        <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">{label}</span>
      </div>

      {/* Agent name */}
      <p className="text-[17px] font-semibold text-[var(--text-primary)] leading-tight truncate mb-0.5">
        {agent.name}
      </p>
      {agent.handle && (
        <p className="text-[12px] text-[var(--accent)] mb-3 font-mono">@{agent.handle}</p>
      )}

      {/* Metrics */}
      <div className="flex gap-2 mb-3">
        <MetricPill value={`${calls.toLocaleString()} calls`} />
        <MetricPill value={`${users} users`} />
        <MetricPill value={`${fees.toFixed(2)} USDC`} accent />
      </div>

      {/* Capabilities */}
      {agent.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {agent.capabilities.slice(0, 2).map(cap => (
            <span key={cap}
              className="text-[11px] px-2 py-0.5 rounded-[5px] bg-[var(--surface1)]
                border border-[var(--border)] text-[var(--text-secondary)]">
              {cap}
            </span>
          ))}
        </div>
      )}

      {/* View link */}
      <Link href={`/explorer/${agent.id}`}
        className="inline-flex items-center gap-1 text-[12px] text-[var(--accent)]
          hover:text-[var(--brand-dark)] transition-colors group">
        View agent
        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform duration-150" />
      </Link>
    </div>
  );
}

function MetricPill({ value, accent }: { value: string; accent?: boolean }) {
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-[5px] border
      ${accent
        ? "bg-green-50 border-green-200 text-green-700"
        : "bg-[var(--surface1)] border-[var(--border)] text-[var(--text-secondary)]"}`}>
      {value}
    </span>
  );
}

interface TrendingRowProps {
  trending: {
    trending: TrendingAgent | null;
    top_grossing: TrendingAgent | null;
  } | null;
}

export function TrendingRow({ trending }: TrendingRowProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <TrendingCard
        agent={trending?.trending ?? null}
        label="Trending · 7d"
        Icon={TrendingUp}
        calls={trending?.trending?.stats.calls7d ?? 0}
        users={trending?.trending?.stats.unique7d ?? 0}
        fees={trending?.trending?.stats.fees30d ?? 0}
      />
      <TrendingCard
        agent={trending?.top_grossing ?? null}
        label="Top Grossing · 30d"
        Icon={DollarSign}
        calls={trending?.top_grossing?.stats.calls30d ?? 0}
        users={trending?.top_grossing?.stats.unique7d ?? 0}
        fees={trending?.top_grossing?.stats.fees30d ?? 0}
      />
    </div>
  );
}
