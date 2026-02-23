"use client";
import Link from "next/link";
import { useWallet } from "@/hooks/useWallet";
import { useRegistry, type AgentData } from "@/hooks/useRegistry";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Plus, Bot, ArrowRight, Wallet } from "lucide-react";

// Avatar colours matching the Explorer AgentRow
const AVATAR_BG = [
  "#DDEAFF", "#D4EDF8", "#E6D9FF", "#CEEDDF",
  "#FFE4D6", "#FFF3D1", "#D8EAFF", "#EDD8FF",
];
const AVATAR_FG = "#0B1220";

function ipfsToHttp(url: string): string {
  if (url.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${url.slice(7)}`;
  return url;
}

function AgentAvatar({ id, name, isActive, image }: { id: number; name: string; isActive: boolean; image?: string }) {
  const bg = AVATAR_BG[id % AVATAR_BG.length];
  const imgSrc = image ? ipfsToHttp(image) : null;
  return (
    <div className="relative flex-shrink-0">
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={name}
          className="w-10 h-10 rounded-[10px] object-cover"
          onError={e => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
            const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
            if (fallback) fallback.style.display = "flex";
          }}
        />
      ) : null}
      <div
        className="w-10 h-10 rounded-[10px] items-center justify-center text-[14px] font-semibold select-none"
        style={{ background: bg, color: AVATAR_FG, display: imgSrc ? "none" : "flex" }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
      <span
        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg1)] ${
          isActive ? "bg-[var(--success)]" : "bg-gray-400"
        }`}
      />
    </div>
  );
}

function MyAgentRow({ agent }: { agent: AgentData }) {
  const price = agent.pricing
    ? `${(parseInt(agent.pricing.amount) / 1e7).toFixed(4)} USDC`
    : null;

  return (
    <Link href={`/explorer/${agent.id}`}>
      <div className="flex items-center gap-3.5 px-4 py-3.5 rounded-[12px]
        border border-[var(--border)] bg-[var(--surface0)]
        hover:bg-[var(--surface1)] hover:border-[var(--accent)]/25
        transition-all duration-150 cursor-pointer group">

        <AgentAvatar id={agent.id} name={agent.name} isActive={agent.is_active} image={agent.image} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold text-[var(--text-primary)] truncate leading-snug">
              {agent.name}
            </span>
            <Badge variant={agent.is_active ? "success" : "default"}>
              {agent.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-[12px] text-[var(--text-muted)] font-mono truncate leading-snug mt-0.5">
            #{agent.id}
            {agent.handle && (
              <> · <span className="text-[var(--accent)]">@{agent.handle}</span></>
            )}
          </p>
        </div>

        {/* Capability pills */}
        <div className="hidden md:flex flex-wrap gap-1 max-w-[200px]">
          {(agent.capabilities ?? []).slice(0, 3).map(cap => (
            <span
              key={cap}
              className="text-[11px] px-2 py-0.5 rounded-[5px]
                bg-[var(--surface1)] border border-[var(--border)] text-[var(--text-secondary)]"
            >
              {cap}
            </span>
          ))}
          {(agent.capabilities ?? []).length > 3 && (
            <span className="text-[11px] px-2 py-0.5 rounded-[5px]
              bg-[var(--surface1)] border border-[var(--border)] text-[var(--text-muted)]">
              +{agent.capabilities!.length - 3}
            </span>
          )}
        </div>

        {/* Pricing */}
        <div className="hidden sm:block text-right flex-shrink-0 w-28">
          {price
            ? <span className="text-[12px] font-medium text-[var(--success)] tabular-nums">{price}/query</span>
            : <span className="text-[12px] text-[var(--text-muted)]">Free</span>}
        </div>

        {/* View on explorer */}
        <span className="hidden sm:flex items-center gap-1 text-[12px] text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          View <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}

function EmptyAgents() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-[14px] bg-[var(--surface1)] border border-[var(--border)]
        flex items-center justify-center mb-4">
        <Bot className="w-7 h-7 text-[var(--text-muted)]" />
      </div>
      <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">No agents yet</h3>
      <p className="text-[13px] text-[var(--text-muted)] mb-5 max-w-xs">
        Register your first AI agent on Stellar to start earning USDC through x402 payments.
      </p>
      <Link href="/register">
        <Button size="md">
          <Plus className="w-4 h-4 mr-1.5" />
          Register First Agent
        </Button>
      </Link>
    </div>
  );
}

function ConnectPrompt() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-[14px] bg-[var(--surface1)] border border-[var(--border)]
        flex items-center justify-center mb-4">
        <Wallet className="w-7 h-7 text-[var(--text-muted)]" />
      </div>
      <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">Connect your wallet</h3>
      <p className="text-[13px] text-[var(--text-muted)] max-w-xs">
        Connect Freighter to view your registered agents.
      </p>
    </div>
  );
}

export default function AgentsPage() {
  const { address, isConnected } = useWallet();
  const { agents, loading } = useRegistry();

  // Filter to only the current user's agents
  const myAgents = isConnected && address
    ? agents.filter(a => a.owner === address)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--text-primary)]">My Agents</h1>
          <p className="text-[14px] text-[var(--text-muted)] mt-0.5">
            AI agents registered under your wallet
            {isConnected && !loading && myAgents.length > 0 && (
              <> · <span className="text-[var(--accent)] font-medium">{myAgents.length} registered</span></>
            )}
          </p>
        </div>
        <Link href="/register">
          <Button size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Register Agent
          </Button>
        </Link>
      </div>

      {/* Content */}
      {!isConnected ? (
        <ConnectPrompt />
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : myAgents.length === 0 ? (
        <EmptyAgents />
      ) : (
        <div className="space-y-2">
          {myAgents.map(agent => (
            <MyAgentRow key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
