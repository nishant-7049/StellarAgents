"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Send, Shield, Zap, TrendingUp } from "lucide-react";

interface QueryInputProps {
  onSubmit: (query: string, risk: string) => void;
  loading?: boolean;
}

const riskOptions = [
  { value: "low", label: "Low Risk", icon: Shield, color: "text-green-400", desc: "Conservative, stable yields" },
  { value: "moderate", label: "Moderate", icon: Zap, color: "text-yellow-400", desc: "Balanced risk/reward" },
  { value: "high", label: "High Risk", icon: TrendingUp, color: "text-red-400", desc: "Maximum yield potential" },
];

export function QueryInput({ onSubmit, loading }: QueryInputProps) {
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("moderate");

  const handleSubmit = () => {
    if (!query.trim()) return;
    onSubmit(query, risk);
    setQuery("");
  };

  return (
    <div className="space-y-3">
      {/* Risk Selector */}
      <div>
        <label className="text-xs text-[var(--text-secondary)] mb-2 block">Risk Tolerance</label>
        <div className="flex gap-2">
          {riskOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = risk === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setRisk(option.value)}
                className={`flex-1 p-2.5 rounded-lg border transition-all ${
                  isSelected
                    ? "border-indigo-400 bg-indigo-500/10"
                    : "border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--border-hover)]"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? option.color : "text-[var(--text-secondary)]"}`} />
                  <span className={`text-xs font-medium ${isSelected ? "text-white" : "text-[var(--text-secondary)]"}`}>
                    {option.label}
                  </span>
                </div>
                {isSelected && (
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{option.desc}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Query Input */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSubmit()}
            placeholder="e.g., What's the best yield strategy for $5000 USDC?"
            disabled={loading}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-3 pr-12 text-sm text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
          />
          <Badge
            variant="default"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
          >
            0.01 USDC
          </Badge>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={loading || !query.trim()}
          className="px-4"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Querying...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Send
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
