"use client";
import { useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ReputationBadge } from "./ReputationBadge";
import { FeedbackList } from "./FeedbackList";
import { ValidationList } from "./ValidationList";
import { useReputation } from "@/hooks/useReputation";

interface AgentDetailProps {
  agent: { id: number; name: string; capabilities?: string[]; pricing?: { amount: string }; status?: string };
}

export function AgentDetail({ agent }: AgentDetailProps) {
  const { summary, loadSummary } = useReputation(agent.id);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  return (
    <div className="space-y-4">
      <Card glow>
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-xl font-bold">{agent.name}</h2>
          <ReputationBadge summary={summary} />
        </div>
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

      <Card>
        <h3 className="font-semibold mb-3">Reputation & Feedback</h3>
        <FeedbackList agentId={agent.id} />
      </Card>

      <Card>
        <h3 className="font-semibold mb-3">Validations</h3>
        <ValidationList agentId={agent.id} />
      </Card>
    </div>
  );
}
