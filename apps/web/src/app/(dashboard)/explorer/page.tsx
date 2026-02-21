"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { fetchAPI } from "@/lib/api";
import { shortenAddress, getTxUrl } from "@/lib/stellar";
import { Bot, Activity, Star, ExternalLink, Zap, Search, AtSign } from "lucide-react";

interface Agent {
  id: number;
  owner: string;
  name: string;
  handle: string | null;
  isActive: boolean;
  capabilities: string[];
  pricing: { amount: string; protocol: string } | null;
  model: string | null;
  reputation: { totalReviews: number; avgScore: number } | null;
  registeredAt: number;
}

interface ActivityItem {
  type: string;
  description: string;
  amountFormatted?: string;
  timestamp: string;
  txHash: string;
}

export default function ExplorerPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);

  useEffect(() => {
    fetchAPI<{ agents: Agent[] }>("/api/explorer/agents?startId=1&limit=20")
      .then(d => setAgents(d.agents))
      .catch(() => {})
      .finally(() => setLoadingAgents(false));

    fetchAPI<{ activity: ActivityItem[] }>("/api/explorer/activity?limit=20")
      .then(d => setActivity(d.activity))
      .catch(() => {})
      .finally(() => setLoadingActivity(false));
  }, []);

  function getTypeColor(type: string) {
    if (type === "payment") return "text-green-400";
    if (type === "agent") return "text-indigo-400";
    if (type === "vault") return "text-amber-400";
    return "text-[var(--text-secondary)]";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Search className="w-6 h-6 text-indigo-400" />
          ERC-8004 Explorer
        </h1>
        <p className="text-[var(--text-secondary)]">
          All registered AI agents and decoded on-chain activity
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Agent Registry */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-400" />
            Agent Registry
          </h2>

          {loadingAgents ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : agents.length === 0 ? (
            <Card>
              <p className="text-sm text-[var(--text-secondary)]">
                No agents registered yet. <Link href="/register" className="text-indigo-400 hover:underline">Register one</Link>.
              </p>
            </Card>
          ) : (
            agents.map((agent, i) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/explorer/${agent.id}`}>
                  <Card className="hover:border-indigo-500/50 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium truncate">{agent.name}</span>
                          <Badge variant="default" className="text-xs">#{agent.id}</Badge>
                          {agent.isActive ? (
                            <Badge variant="success" className="text-xs">Active</Badge>
                          ) : (
                            <Badge variant="error" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                        {agent.handle && (
                          <div className="flex items-center gap-1 mb-1">
                            <AtSign className="w-3 h-3 text-indigo-400" />
                            <span className="text-xs text-indigo-400 font-mono">{agent.handle}</span>
                          </div>
                        )}
                        <div className="text-xs text-[var(--text-secondary)] mb-2">
                          {shortenAddress(agent.owner, 6)}
                        </div>
                        {agent.capabilities.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {agent.capabilities.slice(0, 4).map(cap => (
                              <span key={cap} className="text-xs bg-indigo-600/20 text-indigo-300 px-1.5 py-0.5 rounded">
                                {cap}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="ml-3 text-right flex-shrink-0">
                        {agent.reputation && agent.reputation.totalReviews > 0 ? (
                          <div className="flex items-center gap-1 text-amber-400">
                            <Star className="w-3.5 h-3.5" />
                            <span className="text-sm">{agent.reputation.avgScore.toFixed(1)}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--text-secondary)]">No reviews</span>
                        )}
                        {agent.pricing && (
                          <div className="flex items-center gap-1 text-xs text-green-400 mt-1">
                            <Zap className="w-3 h-3" />
                            <span>{parseInt(agent.pricing.amount) / 10_000_000} USDC</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))
          )}
        </div>

        {/* Global Activity Feed */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-400" />
            Global Activity
          </h2>

          {loadingActivity ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : activity.length === 0 ? (
            <Card>
              <p className="text-sm text-[var(--text-secondary)]">
                No activity yet. Contracts may not be deployed yet.
              </p>
            </Card>
          ) : (
            activity.map((item, i) => (
              <motion.div
                key={`${item.txHash}-${i}`}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="py-2.5 px-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${getTypeColor(item.type)} truncate`}>
                        {item.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-[var(--text-secondary)]">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                        {item.amountFormatted && (
                          <Badge variant="success" className="text-xs">{item.amountFormatted}</Badge>
                        )}
                      </div>
                    </div>
                    {item.txHash && !item.txHash.startsWith("ledger-") && (
                      <a
                        href={getTxUrl(item.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 flex-shrink-0"
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

