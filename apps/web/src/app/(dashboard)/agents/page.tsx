"use client";
import { AgentGrid } from "@/components/agents/AgentGrid";
import { useRegistry } from "@/hooks/useRegistry";
import { Spinner } from "@/components/ui/Spinner";

export default function AgentsPage() {
  const { agents, loading } = useRegistry();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agent Marketplace</h1>
        <p className="text-[var(--text-secondary)]">Browse and discover AI agents on Stellar</p>
      </div>
      {loading ? <Spinner /> : <AgentGrid agents={agents} />}
    </div>
  );
}
