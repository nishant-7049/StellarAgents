"use client";
import { useState } from "react";
import clsx from "clsx";
import { X, Plus } from "lucide-react";
import type { Facets, SortOrder } from "@/hooks/useExplorer";

export const CATEGORIES: { label: string; tags: string[] }[] = [
  { label: "Trading",    tags: ["trading", "trade"] },
  { label: "Portfolio",  tags: ["portfolio", "rebalancing", "rebalance"] },
  { label: "Yield",      tags: ["yield", "defi"] },
  { label: "Payments",   tags: ["payments", "payment"] },
  { label: "Analytics",  tags: ["analytics", "data"] },
  { label: "Automation", tags: ["automation", "automated"] },
  { label: "Dev Tools",  tags: ["devtools", "dev", "tools"] },
  { label: "Security",   tags: ["security", "audit"] },
  { label: "Social",     tags: ["social"] },
  { label: "Content",    tags: ["content", "media"] },
  { label: "Gaming",     tags: ["gaming", "nft"] },
  { label: "Governance", tags: ["governance", "voting"] },
];

interface FilterChipsProps {
  activeCategories: string[];
  onToggle: (label: string) => void;
  facets: Facets;
  onFacet: <K extends keyof Facets>(key: K, value: Facets[K]) => void;
  customTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  sort: SortOrder;
  onSort: (s: SortOrder) => void;
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-2.5 py-1 rounded-[6px] text-[12px] font-medium transition-colors duration-150 border",
        active
          ? "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30"
          : "bg-transparent text-[var(--text-muted)] border-transparent hover:bg-[var(--surface1)] hover:text-[var(--text-secondary)]"
      )}
    >
      {label}
    </button>
  );
}

function SegmentControl<T extends string>({
  value, options, onChange,
}: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-0 rounded-[8px] bg-[var(--surface1)] border border-[var(--border)] p-0.5">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx(
            "px-2.5 py-1 rounded-[6px] text-[12px] font-medium transition-colors duration-150",
            value === opt.value
              ? "bg-[var(--surface0)] text-[var(--text-primary)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function FilterChips({
  activeCategories, onToggle, facets, onFacet, customTags, onAddTag, onRemoveTag, sort, onSort,
}: FilterChipsProps) {
  const [tagInput, setTagInput] = useState("");

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = tagInput.trim().replace(/,$/, "");
      if (tag) { onAddTag(tag); setTagInput(""); }
    }
  }

  return (
    <div className="space-y-2.5">
      {/* Category row */}
      <div className="flex flex-wrap gap-1 items-center">
        {CATEGORIES.map(cat => (
          <FilterChip
            key={cat.label}
            label={cat.label}
            active={activeCategories.includes(cat.label)}
            onClick={() => onToggle(cat.label)}
          />
        ))}

        {/* Custom tag pills */}
        {customTags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-[12px] font-medium
              bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30"
          >
            {tag}
            <button
              onClick={() => onRemoveTag(tag)}
              className="hover:text-[var(--danger)] transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {/* Free-text input */}
        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-[6px]
          bg-transparent border border-dashed border-[var(--border)] text-[12px]">
          <Plus className="w-3 h-3 text-[var(--text-muted)]" />
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="tag…"
            className="w-14 bg-transparent text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] outline-none text-[12px]"
          />
        </div>
      </div>

      {/* Facets + sort row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[var(--text-muted)]">Pricing</span>
          <SegmentControl
            value={facets.pricing ?? "all"}
            options={[
              { label: "All",     value: "all" as const },
              { label: "Free",    value: "free" as const },
              { label: "Credits", value: "credits" as const },
            ]}
            onChange={v => onFacet("pricing", v)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[var(--text-muted)]">Status</span>
          <SegmentControl
            value={facets.status ?? "all"}
            options={[
              { label: "All",      value: "all" as const },
              { label: "Active",   value: "active" as const },
              { label: "Inactive", value: "inactive" as const },
            ]}
            onChange={v => onFacet("status", v)}
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[12px] text-[var(--text-muted)]">Sort</span>
          <SegmentControl
            value={sort}
            options={[
              { label: "Trending",  value: "trending" as SortOrder },
              { label: "Grossing",  value: "grossing" as SortOrder },
              { label: "Newest",    value: "newest"   as SortOrder },
            ]}
            onChange={onSort}
          />
        </div>
      </div>
    </div>
  );
}
