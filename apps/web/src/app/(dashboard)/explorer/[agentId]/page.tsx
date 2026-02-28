"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { fetchAPI } from "@/lib/api";
import { shortenAddress, getTxUrl } from "@/lib/stellar";
import { signAndSubmit } from "@/lib/stellar";
import { useWallet } from "@/hooks/useWallet";
import {
  ArrowLeft, Bot, Star, Zap, ExternalLink, Shield,
  Activity, Hash, TrendingUp, DollarSign, Calendar,
  BarChart3, AtSign, Globe, Cpu, MessageSquarePlus, X,
} from "lucide-react";
import { TransactionBuilder } from "@stellar/stellar-sdk";

interface AgentDetail {
  id: number;
  owner: string;
  name: string;
  handle: string | null;
  agentUri: string;
  vaultAddress: string;
  agentSigner: string;
  registeredAt: number;
  isActive: boolean;
  capabilities: string[];
  categories: string[];
  description: string | null;
  pricing: any;
  model: string | null;
  image?: string | null;
  endpoints: any;
  reputation: { totalReviews: number; totalScore: number; avgScore: number } | null;
  feedback: any[];
  paymentHistory: any[];
}

function ipfsToHttp(url: string): string {
  if (url.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${url.slice(7)}`;
  return url;
}

interface AgentStats {
  isMock: boolean;
  totals: { queries: number; usdcSpent: number; daysActive: number; avgDailyQueries: number };
  daily: { date: string; queries: number; usdcSpent: number }[];
  actions: { action: string; count: number }[];
}

const ACTION_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];
const CATEGORIES = ["quality", "reliability", "speed", "accuracy", "value", "support"];

function formatDate(d: string) {
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

function formatAction(a: string) {
  return a.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--bg1)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs">
      <p className="text-[var(--text-secondary)] mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-medium">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

/* ── Review Modal ── */
function ReviewModal({
  agentId,
  agentName,
  onClose,
  onSuccess,
}: {
  agentId: number;
  agentName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { address } = useWallet();
  const [score, setScore] = useState(0);
  const [hoverScore, setHoverScore] = useState(0);
  const [category, setCategory] = useState("quality");
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!address) { setError("Connect your wallet first."); return; }
    if (score === 0) { setError("Please select a star rating."); return; }
    setSubmitting(true);
    setError(null);
    try {
      // Build tx on backend
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/reputation/${agentId}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewer: address, score, category, dataUri: reviewText.trim(), paymentProofHash: "" }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to build transaction");
      }
      const { xdr } = await res.json();
      // Sign + submit via Freighter
      const tx = TransactionBuilder.fromXDR(xdr, process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE!);
      await signAndSubmit(tx.toXDR());
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md rounded-[18px] bg-[var(--bg1)] border border-[var(--border)]
          shadow-2xl shadow-black/40 p-6 space-y-5"
      >
        {/* Close */}
        <button onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[var(--surface1)] text-[var(--text-muted)]">
          <X className="w-4 h-4" />
        </button>

        <div>
          <h2 className="text-[16px] font-bold text-[var(--text-primary)]">Write a Review</h2>
          <p className="text-[13px] text-[var(--text-muted)] mt-0.5">for <span className="text-[var(--text-secondary)]">{agentName}</span></p>
        </div>

        {/* Star picker */}
        <div>
          <p className="text-[13px] text-[var(--text-secondary)] mb-2">Rating</p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                onClick={() => setScore(s)}
                onMouseEnter={() => setHoverScore(s)}
                onMouseLeave={() => setHoverScore(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-8 h-8 transition-colors ${
                    s <= (hoverScore || score)
                      ? "text-amber-400 fill-amber-400"
                      : "text-[var(--border)]"
                  }`}
                />
              </button>
            ))}
          </div>
          {score > 0 && (
            <p className="text-[12px] text-[var(--text-muted)] mt-1">
              {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][score]}
            </p>
          )}
        </div>

        {/* Category */}
        <div>
          <p className="text-[13px] text-[var(--text-secondary)] mb-2">Category</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium border transition-colors capitalize ${
                  category === cat
                    ? "bg-[var(--accent)]/15 border-[var(--accent)]/40 text-[var(--accent2)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface1)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Review text */}
        <div>
          <p className="text-[13px] text-[var(--text-secondary)] mb-2">
            Review <span className="text-[var(--text-muted)]">(optional)</span>
          </p>
          <textarea
            value={reviewText}
            onChange={e => setReviewText(e.target.value)}
            placeholder="Share your experience with this agent…"
            maxLength={280}
            rows={3}
            className="w-full resize-none rounded-[10px] border border-[var(--border)] bg-[var(--surface1)]
              px-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
              focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:border-[var(--accent)]
              transition-colors"
          />
          <p className="text-[11px] text-[var(--text-muted)] text-right mt-1">
            {reviewText.length}/280
          </p>
        </div>

        {error && (
          <p className="text-[13px] text-[var(--danger)]">{error}</p>
        )}

        {!address && (
          <p className="text-[13px] text-[var(--text-muted)] bg-[var(--surface1)] px-3 py-2 rounded-lg">
            Connect your wallet to submit a review on-chain.
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !address || score === 0}
            className="flex-1"
          >
            {submitting ? "Submitting…" : "Submit Review"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Reputation Banner (top of page) ── */
function ReputationBanner({
  reputation,
  agentId,
  agentName,
  onReviewSuccess,
}: {
  reputation: AgentDetail["reputation"];
  agentId: number;
  agentName: string;
  onReviewSuccess: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const filled = reputation ? Math.round(reputation.avgScore) : 0;

  return (
    <>
      <div className="flex items-center gap-4 px-5 py-4 rounded-[14px]
        border border-[var(--border)] bg-[var(--surface0)]">

        {/* Stars + score */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {reputation && reputation.totalReviews > 0 ? (
            <>
              <span className="text-[36px] font-bold text-amber-400 leading-none tabular-nums">
                {reputation.avgScore.toFixed(1)}
              </span>
              <div>
                <div className="flex gap-0.5 mb-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className={`w-5 h-5 ${s <= filled
                      ? "text-amber-400 fill-amber-400"
                      : "text-[var(--border)]"}`} />
                  ))}
                </div>
                <p className="text-[13px] text-[var(--text-muted)]">
                  {reputation.totalReviews} review{reputation.totalReviews !== 1 ? "s" : ""}
                </p>
              </div>
              {/* Progress bar */}
              <div className="flex-1 hidden sm:block">
                <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden max-w-[200px]">
                  <div className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width: `${(reputation.avgScore / 5) * 100}%` }} />
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star key={s} className="w-5 h-5 text-[var(--border)]" />
                ))}
              </div>
              <span className="text-[13px] text-[var(--text-muted)]">No reviews yet — be the first!</span>
            </div>
          )}
        </div>

        {/* CTA */}
        <Button size="sm" onClick={() => setShowModal(true)}>
          <MessageSquarePlus className="w-3.5 h-3.5 mr-1.5" />
          Write Review
        </Button>
      </div>

      {showModal && (
        <ReviewModal
          agentId={agentId}
          agentName={agentName}
          onClose={() => setShowModal(false)}
          onSuccess={onReviewSuccess}
        />
      )}
    </>
  );
}

/* ── Full Reviews Section ── */
function ReviewsSection({ agentId }: { agentId: number }) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchAPI<any>(`/api/reputation/${agentId}/feedback?limit=50`)
      .then(data => setReviews(data?.feedback || []))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, [agentId]);

  const visible = showAll ? reviews : reviews.slice(0, 5);

  if (loading) return <div className="flex justify-center py-6"><Spinner /></div>;
  if (reviews.length === 0) return null;

  return (
    <Card>
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <MessageSquarePlus className="w-4 h-4 text-[var(--accent)]" />
        Reviews
        <span className="text-[13px] font-normal text-[var(--text-muted)]">({reviews.length})</span>
      </h3>

      <div className="space-y-3">
        {visible.map((fb: any, i: number) => (
          <div key={i} className="p-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface0)]">
            <div className="flex items-center gap-2 mb-2">
              {/* Stars */}
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star key={s} className={`w-3.5 h-3.5 ${s <= fb.score
                    ? "text-amber-400 fill-amber-400"
                    : "text-[var(--border)]"}`} />
                ))}
              </div>
              <span className="text-[12px] font-semibold text-amber-500 tabular-nums">
                {fb.score}/5
              </span>
              {fb.category && (
                <Badge variant="default" className="text-[11px] capitalize ml-1">{fb.category}</Badge>
              )}
              <span className="ml-auto text-[11px] text-[var(--text-muted)] font-mono">
                {shortenAddress(fb.reviewer || "", 6)}
              </span>
            </div>
            {fb.data_uri && fb.data_uri !== "" && (
              <p className="text-[13px] text-[var(--text-secondary)]">{fb.data_uri}</p>
            )}
          </div>
        ))}
      </div>

      {reviews.length > 5 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-3 text-[13px] text-[var(--accent)] hover:underline"
        >
          {showAll ? "Show less" : `Show all ${reviews.length} reviews`}
        </button>
      )}
    </Card>
  );
}

export default function AgentProfilePage() {
  const { agentId } = useParams();
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    if (!agentId) return;
    Promise.all([
      fetchAPI<AgentDetail>(`/api/explorer/agents/${agentId}`),
      fetchAPI<AgentStats>(`/api/explorer/agents/${agentId}/stats`),
    ])
      .then(([agentData, statsData]) => { setAgent(agentData); setStats(statsData); })
      .catch(err => setError(err.message));
  };

  useEffect(() => {
    if (!agentId) return;
    Promise.all([
      fetchAPI<AgentDetail>(`/api/explorer/agents/${agentId}`),
      fetchAPI<AgentStats>(`/api/explorer/agents/${agentId}/stats`),
    ])
      .then(([agentData, statsData]) => { setAgent(agentData); setStats(statsData); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [agentId]);

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error || !agent) {
    return (
      <Card>
        <p className="text-red-400">{error || "Agent not found"}</p>
        <Link href="/explorer" className="text-[var(--accent)] hover:underline mt-2 block">← Back</Link>
      </Card>
    );
  }

  const registeredDate = agent.registeredAt
    ? new Date(Number(agent.registeredAt) * 1000).toLocaleDateString()
    : "Unknown";

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/explorer" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        {/* Agent image / avatar */}
        {agent.image ? (
          <img
            src={ipfsToHttp(agent.image)}
            alt={agent.name}
            className="w-12 h-12 rounded-[10px] object-cover flex-shrink-0"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-12 h-12 rounded-[10px] flex-shrink-0 flex items-center justify-center
            bg-[var(--accent)]/15 text-[var(--accent2)] text-xl font-bold select-none">
            {agent.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{agent.name}</h1>
            <Badge variant="default">#{agent.id}</Badge>
            {agent.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="error">Inactive</Badge>}
            {stats?.isMock && <Badge variant="info" className="text-xs">Demo data</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {agent.handle && (
              <span className="flex items-center gap-1 text-[var(--accent)] font-mono text-sm font-medium">
                <AtSign className="w-3.5 h-3.5" />{agent.handle}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Reputation Banner — stars + Write Review CTA */}
      <ReputationBanner
        reputation={agent.reputation}
        agentId={agent.id}
        agentName={agent.name}
        onReviewSuccess={reload}
      />

      {/* Stats Row */}
      {stats && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[
            { icon: <Hash className="w-4 h-4 text-[var(--accent)]" />, label: "Total Queries", value: stats.totals.queries.toLocaleString(), color: "bg-[var(--accent)]/15" },
            { icon: <DollarSign className="w-4 h-4 text-[var(--success)]" />, label: "USDC Paid", value: `$${stats.totals.usdcSpent.toFixed(3)}`, color: "bg-[var(--success)]/15" },
            { icon: <Calendar className="w-4 h-4 text-amber-500" />, label: "Days Active", value: stats.totals.daysActive, color: "bg-amber-500/15" },
            { icon: <TrendingUp className="w-4 h-4 text-purple-500" />, label: "Avg / Day", value: stats.totals.avgDailyQueries, color: "bg-purple-500/15" },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${s.color}`}>{s.icon}</div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">{s.label}</p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">{s.value}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Charts Row */}
      {stats && (
        <div className="grid gap-6 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm">
                <BarChart3 className="w-4 h-4 text-[var(--accent)]" />
                Daily Queries — Last 30 Days
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={stats.daily} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: "var(--text-muted)" }} interval={6} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="queries" name="Queries" fill="var(--accent)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card>
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-[var(--success)]" />
                USDC Spent via x402 — Last 30 Days
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={stats.daily} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="usdcGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: "var(--text-muted)" }} interval={6} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="usdcSpent" name="USDC" stroke="#22c55e" fill="url(#usdcGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Action Breakdown */}
      {stats && stats.actions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4 text-amber-500" />
              Action Breakdown
            </h3>
            <div className="space-y-2.5">
              {stats.actions.map((a, i) => {
                const pct = Math.round((a.count / stats.totals.queries) * 100);
                return (
                  <div key={a.action} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--text-secondary)]">{formatAction(a.action)}</span>
                      <span className="font-medium text-[var(--text-primary)]">{a.count} <span className="text-[var(--text-muted)]">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                      <motion.div className="h-full rounded-full" style={{ backgroundColor: ACTION_COLORS[i % ACTION_COLORS.length] }}
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: 0.35 + i * 0.05 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Details + Reputation + History */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Left: Identity + Reputation */}
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <Card>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Bot className="w-4 h-4 text-[var(--accent)]" />
                Identity
              </h3>
              <div className="space-y-3 text-sm">
                {agent.handle && (
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-secondary)] flex items-center gap-1"><AtSign className="w-3 h-3" /> Handle</span>
                    <span className="font-mono text-[var(--accent)]">@{agent.handle}</span>
                  </div>
                )}
                <Row label="Agent ID" value={`#${agent.id}`} />
                <Row label="Owner" value={shortenAddress(agent.owner, 8)} mono link={`https://stellar.expert/explorer/public/account/${agent.owner}`} />
                <Row label="Vault" value={shortenAddress(agent.vaultAddress, 8)} mono link={`https://stellar.expert/explorer/public/contract/${agent.vaultAddress}`} />
                <Row label="Signer" value={shortenAddress(agent.agentSigner, 8)} mono link={`https://stellar.expert/explorer/public/account/${agent.agentSigner}`} />
                <Row label="Registered" value={registeredDate} />
                {agent.model && (
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-secondary)] flex items-center gap-1"><Cpu className="w-3 h-3" /> Model</span>
                    <span className="text-xs font-mono bg-[var(--surface1)] px-2 py-0.5 rounded">{agent.model}</span>
                  </div>
                )}
                {agent.endpoints?.query && (
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-secondary)] flex items-center gap-1"><Globe className="w-3 h-3" /> Endpoint</span>
                    <a href={agent.endpoints.query} target="_blank" rel="noopener noreferrer"
                       className="text-xs text-[var(--accent)] hover:underline truncate max-w-[180px]">
                      {agent.endpoints.query.replace("https://", "")}
                    </a>
                  </div>
                )}
              </div>

              {agent.description && (
                <div className="mt-4 text-sm text-[var(--text-secondary)] leading-relaxed">
                  {agent.description}
                </div>
              )}

              {agent.categories.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-[var(--text-secondary)] mb-2">Categories</p>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.categories.map(cat => (
                      <span key={cat} className="text-xs bg-[var(--accent)]/15 text-[var(--accent2)] px-2 py-1 rounded-full capitalize">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {agent.capabilities.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-[var(--text-secondary)] mb-2">Capabilities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.capabilities.map(cap => (
                      <span key={cap} className="text-xs bg-[var(--surface1)] border border-[var(--border)] text-[var(--text-secondary)] px-2 py-1 rounded-full capitalize">
                        {cap.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {agent.pricing && (
                <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-[var(--success)]/10 border border-[var(--success)]/20 rounded-lg">
                  <Zap className="w-4 h-4 text-[var(--success)] shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-[var(--success)]">
                      {parseInt(agent.pricing.amount || "100000") / 10_000_000} USDC per query
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Paid via {agent.pricing.protocol || "x402"} · {agent.pricing.asset || "USDC"} on Stellar
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>

        </div>

        {/* Right: Transaction History */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="h-fit">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--success)]" />
              Transaction History
            </h3>
            {agent.paymentHistory.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">No transactions yet.</p>
            ) : (
              <div className="space-y-0">
                {agent.paymentHistory.slice(0, 12).map((item: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
                    <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${
                      item.type === "payment" ? "bg-[var(--success)]/15" :
                      item.type === "agent" ? "bg-[var(--accent)]/15" :
                      item.type === "vault" ? "bg-amber-500/15" : "bg-[var(--surface1)]"
                    }`}>
                      {item.type === "payment" ? <Zap className="w-3 h-3 text-[var(--success)]" /> :
                       item.type === "agent" ? <Bot className="w-3 h-3 text-[var(--accent)]" /> :
                       item.type === "vault" ? <Shield className="w-3 h-3 text-amber-500" /> :
                       <Activity className="w-3 h-3 text-[var(--text-muted)]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text-primary)] leading-snug">{item.description}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">{new Date(item.timestamp).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.amountFormatted && (
                        <Badge variant="success" className="text-xs whitespace-nowrap">{item.amountFormatted}</Badge>
                      )}
                      {item.txHash && !item.txHash.startsWith("ledger-") && (
                        <a href={getTxUrl(item.txHash)} target="_blank" rel="noopener noreferrer"
                           className="text-[var(--accent)] hover:text-[var(--accent2)]">
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

      {/* Reviews Section */}
      <ReviewsSection agentId={agent.id} />

    </div>
  );
}

function Row({ label, value, mono, link }: { label: string; value: string; mono?: boolean; link?: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[var(--text-secondary)]">{label}</span>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer"
           className={`text-[var(--accent)] hover:underline ${mono ? "font-mono text-xs" : ""}`}>
          {value} <ExternalLink className="w-3 h-3 inline" />
        </a>
      ) : (
        <span className={`text-[var(--text-primary)] ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
      )}
    </div>
  );
}
