"use client";
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import clsx from "clsx";
import type { GraphPoint } from "@/hooks/useExplorer";

/* ── Custom tooltip ── */
function ChartTooltip({ active, payload, label, metric }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg1)]
      shadow-[0_4px_12px_rgba(15,23,42,0.10)] px-3 py-2 text-[12px]">
      <p className="text-[var(--text-muted)] mb-1">{label}</p>
      <p className="font-medium text-[var(--text-primary)] tabular-nums">
        {metric === "fees" ? `${Number(val).toFixed(4)} USDC` : `${Number(val).toLocaleString()} calls`}
      </p>
    </div>
  );
}

interface GraphCardProps {
  data: GraphPoint[];
  metric: "calls" | "fees";
  onMetricChange: (m: "calls" | "fees") => void;
}

export function GraphCard({ data, metric, onMetricChange }: GraphCardProps) {
  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface0)]
      shadow-[0_1px_3px_rgba(15,23,42,0.06)]">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <span className="text-[14px] font-semibold text-[var(--text-primary)]">
            Ecosystem Activity
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded-[5px]
            bg-[var(--surface1)] border border-[var(--border)]
            text-[var(--text-muted)] font-medium tabular-nums">
            30d
          </span>
        </div>
        <div className="flex items-center gap-0 rounded-[7px] bg-[var(--surface1)] border border-[var(--border)] p-0.5">
          {(["calls", "fees"] as const).map(m => (
            <button
              key={m}
              onClick={() => onMetricChange(m)}
              className={clsx(
                "px-2.5 py-1 rounded-[5px] text-[12px] font-medium transition-colors duration-150 capitalize",
                metric === m
                  ? "bg-[var(--surface0)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              {m === "calls" ? "Calls" : "Fees"}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 pb-4 pt-3 h-48">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-[13px] text-[var(--text-muted)]">Loading…</p>
          </div>
        ) : metric === "calls" ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 0 }} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="rgba(15,23,42,0.06)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "rgba(11,18,32,0.45)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={5}
              />
              <YAxis hide />
              <Tooltip content={<ChartTooltip metric="calls" />} cursor={{ fill: "rgba(31,102,255,0.04)" }} />
              <Bar dataKey="calls" fill="var(--accent)" radius={[3, 3, 0, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="feeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#22C55E" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#22C55E" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(15,23,42,0.06)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "rgba(11,18,32,0.45)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={5}
              />
              <YAxis hide />
              <Tooltip content={<ChartTooltip metric="fees" />} cursor={{ stroke: "rgba(15,23,42,0.08)" }} />
              <Area
                dataKey="fees"
                stroke="#22C55E"
                strokeWidth={1.5}
                fill="url(#feeGrad)"
                dot={false}
                activeDot={{ r: 3, fill: "#22C55E", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
