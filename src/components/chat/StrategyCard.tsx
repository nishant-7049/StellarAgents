"use client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface StrategyCardProps {
  strategy: {
    protocol: string;
    action: string;
    allocation_pct: number;
    estimated_apy: number;
    risk_level: string;
    details: string;
  };
}

export function StrategyCard({ strategy }: StrategyCardProps) {
  const riskVariant = strategy.risk_level === "low" ? "success" : strategy.risk_level === "high" ? "error" : "warning";

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 right-0 w-16 h-16 flex items-center justify-center text-2xl font-bold text-indigo-400/20">
        {strategy.allocation_pct}%
      </div>
      <div className="flex items-center gap-2 mb-2">
        <h4 className="font-semibold text-sm">{strategy.protocol}</h4>
        <Badge variant={riskVariant}>{strategy.risk_level}</Badge>
      </div>
      <p className="text-xs text-[var(--text-secondary)] mb-2">{strategy.action}</p>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-lg font-bold text-green-400">{strategy.estimated_apy}%</span>
          <span className="text-xs text-[var(--text-secondary)] ml-1">APY</span>
        </div>
        <div className="text-sm font-semibold">{strategy.allocation_pct}% allocation</div>
      </div>
      <p className="text-xs text-[var(--text-secondary)] mt-2">{strategy.details}</p>
    </Card>
  );
}
