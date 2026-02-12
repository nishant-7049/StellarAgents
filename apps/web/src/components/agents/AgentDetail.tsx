"use client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface AgentDetailProps {
  agent: { id: number; name: string; capabilities?: string[]; pricing?: { amount: string }; status?: string };
}

export function AgentDetail({ agent }: AgentDetailProps) {
  return (
    <Card glow>
      <h2 className="text-xl font-bold mb-2">{agent.name}</h2>
      <div className="flex gap-2 mb-4">
        {agent.capabilities?.map(c => <Badge key={c} variant="info">{c}</Badge>)}
      </div>
      <div className="space-y-2 text-sm">
        <div><span className="text-[var(--text-secondary)]">ID:</span> {agent.id}</div>
        <div><span className="text-[var(--text-secondary)]">Status:</span> {agent.status || "active"}</div>
        {agent.pricing && (
          <div><span className="text-[var(--text-secondary)]">Price:</span> {(parseInt(agent.pricing.amount) / 10_000_000).toFixed(2)} USDC/query</div>
        )}
      </div>
    </Card>
  );
}
