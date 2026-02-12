"use client";
import { Card } from "@/components/ui/Card";

const stats = [
  { label: "Total Vaults", value: "0", change: "" },
  { label: "Active Agents", value: "3", change: "" },
  { label: "x402 Transactions", value: "0", change: "" },
  { label: "USDC Volume", value: "$0.00", change: "" },
];

export function StatsCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map(s => (
        <Card key={s.label}>
          <div className="text-sm text-[var(--text-secondary)]">{s.label}</div>
          <div className="mt-1 text-2xl font-bold">{s.value}</div>
        </Card>
      ))}
    </div>
  );
}
