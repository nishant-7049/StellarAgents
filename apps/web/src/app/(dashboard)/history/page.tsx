"use client";
import { Card } from "@/components/ui/Card";

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Transaction History</h1>
        <p className="text-[var(--text-secondary)]">View all x402 payments and vault operations</p>
      </div>
      <Card>
        <p className="text-sm text-[var(--text-secondary)]">No transactions yet. Create a vault and query an agent to see activity here.</p>
      </Card>
    </div>
  );
}
