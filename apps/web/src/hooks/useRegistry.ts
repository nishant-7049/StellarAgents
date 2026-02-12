"use client";
import { useState, useEffect } from "react";
import { fetchAgents } from "@/lib/api";

export function useRegistry() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchAgents().then(data => setAgents(data.agents || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function registerAgent(params: { name: string; capabilities: string[]; pricing: string }) {
    // Would use Freighter to sign AgentRegistry.register() transaction
    setAgents(prev => [...prev, { id: prev.length + 1, ...params, status: "active" }]);
  }

  return { agents, loading, registerAgent };
}
