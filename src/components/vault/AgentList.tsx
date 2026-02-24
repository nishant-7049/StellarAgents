"use client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const demoAgents = [
  { address: "GAGENT1...", dailyLimit: "10.00", spent: "0.00", active: true },
];

export function AgentList() {
  return (
    <Card>
      <h3 className="font-semibold mb-4">Authorized Agents</h3>
      {demoAgents.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">No agents authorized yet</p>
      ) : (
        <div className="space-y-3">
          {demoAgents.map(a => (
            <div key={a.address} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
              <div>
                <span className="text-sm font-mono">{a.address}</span>
                <div className="text-xs text-[var(--text-secondary)]">Limit: {a.dailyLimit} USDC/day | Spent: {a.spent}</div>
              </div>
              <Badge variant={a.active ? "success" : "error"}>{a.active ? "Active" : "Inactive"}</Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
