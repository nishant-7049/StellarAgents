"use client";
import { AgentCard } from "./AgentCard";

interface AgentGridProps {
  agents: any[];
}

export function AgentGrid({ agents }: AgentGridProps) {
  if (agents.length === 0) {
    return <p className="text-[var(--text-secondary)]">No agents registered yet.</p>;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {agents.map(agent => <AgentCard key={agent.id} agent={agent} />)}
    </div>
  );
}
