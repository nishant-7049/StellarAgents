"use client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TrendingUp, Shield, Zap, DollarSign, Info } from "lucide-react";
import { motion } from "framer-motion";

interface Strategy {
  protocol: string;
  action: string;
  allocation_pct: number;
  estimated_apy: number;
  risk_level: "low" | "moderate" | "high";
  details: string;
}

interface StrategyDisplayProps {
  strategies: Strategy[];
  totalApy: number;
  summary: string;
}

const riskColors = {
  low: "text-green-400 bg-green-400/10 border-green-400/20",
  moderate: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  high: "text-red-400 bg-red-400/10 border-red-400/20",
};

const riskIcons = {
  low: Shield,
  moderate: Zap,
  high: TrendingUp,
};

export function StrategyDisplay({ strategies, totalApy, summary }: StrategyDisplayProps) {
  return (
    <div className="space-y-4 mt-4">
      {/* Summary Card */}
      <Card className="p-4 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-400/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            <span className="font-semibold">Estimated Portfolio APY</span>
          </div>
          <div className="text-2xl font-bold text-green-400">{totalApy.toFixed(2)}%</div>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">{summary}</p>
      </Card>

      {/* Allocation Visualization */}
      <div className="space-y-2">
        <div className="text-sm font-medium mb-2">Recommended Allocation</div>
        <div className="flex h-3 rounded-full overflow-hidden bg-[var(--bg-secondary)]">
          {strategies.map((strategy, index) => (
            <motion.div
              key={index}
              initial={{ width: 0 }}
              animate={{ width: `${strategy.allocation_pct}%` }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative group cursor-help ${
                strategy.risk_level === "low"
                  ? "bg-green-500"
                  : strategy.risk_level === "moderate"
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
              title={`${strategy.protocol}: ${strategy.allocation_pct}%`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {strategies.map((strategy, index) => (
            <div key={index} className="flex items-center gap-1.5 text-xs">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  strategy.risk_level === "low"
                    ? "bg-green-500"
                    : strategy.risk_level === "moderate"
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
              />
              <span className="text-[var(--text-secondary)]">
                {strategy.protocol} ({strategy.allocation_pct}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Strategy Cards */}
      <div className="space-y-3">
        {strategies.map((strategy, index) => {
          const RiskIcon = riskIcons[strategy.risk_level];
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-sm mb-1">{strategy.protocol}</h4>
                    <p className="text-xs text-[var(--text-secondary)]">{strategy.action}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-lg font-bold text-green-400">
                      {strategy.estimated_apy.toFixed(1)}%
                    </div>
                    <Badge
                      variant="default"
                      className={`text-xs ${riskColors[strategy.risk_level]} border`}
                    >
                      <RiskIcon className="w-3 h-3 mr-1" />
                      {strategy.risk_level}
                    </Badge>
                  </div>
                </div>

                {/* Allocation Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[var(--text-secondary)]">Allocation</span>
                    <span className="font-semibold">{strategy.allocation_pct}%</span>
                  </div>
                  <div className="h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${strategy.allocation_pct}%` }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                    />
                  </div>
                </div>

                {/* Details */}
                <div className="flex items-start gap-2 p-2 bg-[var(--bg-secondary)] rounded-lg">
                  <Info className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-[var(--text-secondary)]">{strategy.details}</p>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Disclaimer */}
      <div className="text-xs text-[var(--text-secondary)] text-center p-3 bg-[var(--bg-secondary)] rounded-lg">
        ⚠️ APY estimates based on current rates. Not financial advice. DYOR before investing.
      </div>
    </div>
  );
}
