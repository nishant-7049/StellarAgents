"use client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface AgentCardProps {
  agent: { id: number; name: string; capabilities?: string[]; pricing?: { amount: string }; status?: string };
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <Card glow className="hover:border-indigo-500/50 transition-colors cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold">{agent.name}</h3>
        <Badge variant={agent.status === "active" ? "success" : "default"}>{agent.status || "active"}</Badge>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {agent.capabilities?.map(c => <Badge key={c} variant="info">{c}</Badge>)}
      </div>
      {agent.pricing && (
        <div className="text-sm text-[var(--text-secondary)]">
          {(parseInt(agent.pricing.amount) / 10_000_000).toFixed(2)} USDC per query
        </div>
      )}
    </Card>
  );
}
