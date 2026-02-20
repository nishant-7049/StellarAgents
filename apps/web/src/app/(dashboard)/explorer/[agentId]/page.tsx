"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { fetchAPI } from "@/lib/api";
import { shortenAddress, getTxUrl } from "@/lib/stellar";
import { ArrowLeft, Bot, Star, Zap, ExternalLink, Shield, Activity } from "lucide-react";

interface AgentDetail {
  id: number;
  owner: string;
  name: string;
  agentUri: string;
  vaultAddress: string;
  agentSigner: string;
  registeredAt: number;
  isActive: boolean;
  capabilities: string[];
  pricing: any;
  model: string | null;
  endpoints: any;
  reputation: {
    totalReviews: number;
    totalScore: number;
    avgScore: number;
  } | null;
  feedback: any[];
  paymentHistory: any[];
}

export default function AgentProfilePage() {
  const { agentId } = useParams();
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId) return;
    fetchAPI<AgentDetail>(`/api/explorer/agents/${agentId}`)
      .then(data => setAgent(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [agentId]);

  if (loading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  if (error || !agent) {
    return (
      <Card>
        <p className="text-red-400">{error || "Agent not found"}</p>
        <Link href="/explorer" className="text-indigo-400 hover:underline mt-2 block">← Back to Explorer</Link>
      </Card>
    );
  }

  const registeredDate = agent.registeredAt
    ? new Date(Number(agent.registeredAt) * 1000).toLocaleDateString()
    : "Unknown";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/explorer" className="text-[var(--text-secondary)] hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">{agent.name}</h1>
        <Badge variant="default">#{agent.id}</Badge>
        {agent.isActive ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="error">Inactive</Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Details */}
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card glow>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Bot className="w-4 h-4 text-indigo-400" />
                Agent Details
              </h3>
              <div className="space-y-3 text-sm">
                <Row label="Owner" value={shortenAddress(agent.owner, 8)} mono />
                <Row label="Vault" value={shortenAddress(agent.vaultAddress, 8)} mono />
                <Row label="Signer" value={shortenAddress(agent.agentSigner, 8)} mono />
                <Row label="Registered" value={registeredDate} />
                {agent.model && <Row label="Model" value={agent.model} />}
              </div>

              {agent.capabilities.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-[var(--text-secondary)] mb-2">Capabilities</p>
                  <div className="flex flex-wrap gap-1">
                    {agent.capabilities.map(cap => (
                      <span key={cap} className="text-xs bg-indigo-600/20 text-indigo-300 px-2 py-1 rounded-full">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {agent.pricing && (
                <div className="mt-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="text-sm">
                    {parseInt(agent.pricing.amount || "100000") / 10_000_000} USDC per query
                  </span>
                  <Badge variant="default">{agent.pricing.protocol || "x402"}</Badge>
                </div>
              )}
            </Card>
          </motion.div>

          {/* Reputation */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" />
                Reputation
              </h3>
              {agent.reputation ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl font-bold text-amber-400">
                      {agent.reputation.avgScore.toFixed(1)}
                    </div>
                    <div>
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(star => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${star <= agent.reputation!.avgScore ? "text-amber-400 fill-amber-400" : "text-[var(--border)]"}`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {agent.reputation.totalReviews} review{agent.reputation.totalReviews !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">No reviews yet</p>
              )}

              {agent.feedback.length > 0 && (
                <div className="mt-4 space-y-2">
                  {agent.feedback.slice(0, 3).map((fb: any, i: number) => (
                    <div key={i} className="border-t border-[var(--border)] pt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-3 h-3 text-indigo-400" />
                        <span className="text-xs text-[var(--text-secondary)]">
                          {shortenAddress(fb.reviewer || "", 6)}
                        </span>
                        <span className="text-xs text-amber-400">★ {fb.score}</span>
                      </div>
                      {fb.category && (
                        <span className="text-xs text-[var(--text-secondary)]">Category: {fb.category}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        </div>

        {/* Payment History */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="h-fit">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-400" />
              Payment History
            </h3>
            {agent.paymentHistory.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">No payment history yet.</p>
            ) : (
              <div className="space-y-2">
                {agent.paymentHistory.slice(0, 10).map((item: any, i: number) => (
                  <div key={i} className="flex items-start justify-between py-2 border-b border-[var(--border)] last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{item.description}</p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {item.amountFormatted && (
                        <Badge variant="success" className="text-xs whitespace-nowrap">{item.amountFormatted}</Badge>
                      )}
                      {item.txHash && !item.txHash.startsWith("ledger-") && (
                        <a
                          href={getTxUrl(item.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value}</span>
    </div>
  );
}
