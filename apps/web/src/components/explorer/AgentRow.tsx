import Link from "next/link";
import { Star, ArrowRight } from "lucide-react";
import type { Agent } from "@/hooks/useExplorer";

/* ── Muted light-theme avatar palette ── */
const AVATAR_BG = [
  "#DDEAFF", // soft periwinkle
  "#D4EDF8", // soft sky
  "#E6D9FF", // soft violet
  "#CEEDDF", // soft mint
  "#FFE4D6", // soft peach
  "#FFF3D1", // soft warm
  "#D8EAFF", // soft blue
  "#EDD8FF", // soft lavender
];
const AVATAR_FG = "#0B1220";

function ipfsToHttp(url: string): string {
  if (url.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${url.slice(7)}`;
  }
  return url;
}

function AgentAvatar({ id, name, isActive, image }: { id: number; name: string; isActive: boolean; image?: string | null }) {
  const bg = AVATAR_BG[id % AVATAR_BG.length];
  const imgSrc = image ? ipfsToHttp(image) : null;
  return (
    <div className="relative flex-shrink-0">
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={name}
          className="w-9 h-9 rounded-[8px] object-cover"
          onError={e => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
            const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
            if (fallback) fallback.style.display = "flex";
          }}
        />
      ) : null}
      <div
        className="w-9 h-9 rounded-[8px] items-center justify-center text-[13px] font-semibold select-none"
        style={{ background: bg, color: AVATAR_FG, display: imgSrc ? "none" : "flex" }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
      <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[var(--bg1)]
        ${isActive ? "bg-[var(--success)]" : "bg-[rgba(15,23,42,0.18)]"}`} />
    </div>
  );
}

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export function AgentRow({ agent }: { agent: Agent }) {
  const price = agent.pricing
    ? `${(parseInt(agent.pricing.amount) / 1e7).toFixed(2)} USDC`
    : null;

  return (
    <Link href={`/explorer/${agent.id}`}>
      <div className="flex items-center gap-3.5 px-4 py-3 rounded-[10px]
        border border-[var(--border)] bg-[var(--surface0)]
        hover:bg-[var(--surface1)] hover:border-[var(--accent)]/20
        transition-colors duration-150 cursor-pointer group">

        <AgentAvatar id={agent.id} name={agent.name} isActive={agent.isActive} image={agent.image} />

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-[var(--text-primary)] truncate leading-snug">
            {agent.name}
          </p>
          {agent.description ? (
            <p className="text-[12px] text-[var(--text-secondary)] truncate leading-snug mt-0.5">
              {agent.description}
            </p>
          ) : (
            <p className="text-[12px] text-[var(--text-muted)] font-mono truncate leading-snug mt-0.5">
              #{agent.id}
              {agent.handle && <> · <span className="text-[var(--accent)]">@{agent.handle}</span></>}
              {" · "}{agent.owner.slice(0, 6)}…{agent.owner.slice(-4)}
            </p>
          )}
          {agent.description && (
            <p className="text-[11px] text-[var(--text-muted)] font-mono truncate leading-snug">
              #{agent.id}
              {agent.handle && <> · <span className="text-[var(--accent)]">@{agent.handle}</span></>}
            </p>
          )}
        </div>

        {/* Capabilities + categories */}
        <div className="hidden md:flex flex-wrap gap-1 max-w-[200px]">
          {(agent.categories ?? []).slice(0, 1).map(cat => (
            <span key={cat}
              className="text-[11px] px-2 py-0.5 rounded-[5px]
                bg-[var(--accent)]/10 border border-[var(--accent)]/20
                text-[var(--accent2)] capitalize">
              {cat}
            </span>
          ))}
          {agent.capabilities.slice(0, 2).map(cap => (
            <span key={cap}
              className="text-[11px] px-2 py-0.5 rounded-[5px]
                bg-[var(--surface1)] border border-[var(--border)]
                text-[var(--text-secondary)]">
              {cap}
            </span>
          ))}
          {agent.capabilities.length > 2 && (
            <span className="text-[11px] px-2 py-0.5 rounded-[5px]
              bg-[var(--surface1)] border border-[var(--border)] text-[var(--text-muted)]">
              +{agent.capabilities.length - 2}
            </span>
          )}
        </div>

        {/* Pricing */}
        <div className="w-20 text-right flex-shrink-0 hidden sm:block">
          {price
            ? <span className="text-[12px] font-medium text-[var(--success)] tabular-nums">{price}</span>
            : <span className="text-[12px] text-[var(--text-muted)]">Free</span>}
        </div>

        {/* Rating */}
        <div className="flex-shrink-0 hidden sm:flex flex-col items-end gap-0.5">
          {agent.reputation && agent.reputation.totalReviews > 0 ? (
            <>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star key={s} className={`w-3 h-3 ${
                    s <= Math.round(agent.reputation!.avgScore)
                      ? "text-amber-400 fill-amber-400"
                      : "text-[var(--border)] fill-[var(--border)]"
                  }`} />
                ))}
              </div>
              <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
                {agent.reputation.avgScore.toFixed(1)} ({agent.reputation.totalReviews})
              </span>
            </>
          ) : (
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className="w-3 h-3 text-[var(--border)] fill-[var(--border)]" />
              ))}
            </div>
          )}
        </div>

        {/* Date */}
        <div className="w-28 text-right flex-shrink-0 hidden lg:block">
          <span className="text-[12px] text-[var(--text-muted)] tabular-nums">{formatDate(agent.registeredAt)}</span>
        </div>

        <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-50
          transition-opacity flex-shrink-0" />
      </div>
    </Link>
  );
}

export function AgentRowSkeleton() {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3 rounded-[10px]
      border border-[var(--border)] bg-[var(--surface0)]">
      <div className="w-9 h-9 rounded-[8px] skeleton" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-36 rounded skeleton" />
        <div className="h-3 w-52 rounded skeleton" />
      </div>
      <div className="hidden md:flex gap-1">
        <div className="h-5 w-14 rounded-[5px] skeleton" />
        <div className="h-5 w-14 rounded-[5px] skeleton" />
      </div>
      <div className="hidden sm:block w-20 h-3 rounded skeleton" />
    </div>
  );
}
