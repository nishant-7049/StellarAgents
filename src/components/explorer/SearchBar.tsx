"use client";
import { useRef, useState, useEffect } from "react";
import { Search, X, Clock, Hash } from "lucide-react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "explorer_recent_searches";
const MAX_RECENT = 5;

function getRecent(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function saveRecent(term: string) {
  const recent = getRecent().filter(r => r !== term);
  recent.unshift(term);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

const POPULAR_TAGS = ["yield", "trading", "defi", "portfolio", "rebalancing", "payments", "analytics"];

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  onTagSearch?: (tag: string) => void;
}

export function SearchBar({ value, onChange, onTagSearch }: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => { if (focused) setRecent(getRecent()); }, [focused]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setFocused(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const v = value.trim();
    if (!v) return;
    if (/^[GC][A-Z2-7]{55}$/.test(v)) {
      saveRecent(v);
      router.push(`/explorer?addr=${v}`);
      return;
    }
    if (v.startsWith("@")) {
      saveRecent(v);
      router.push(`/explorer?handle=${encodeURIComponent(v.slice(1))}`);
      return;
    }
    if (v.startsWith("id:")) { router.push(`/explorer/${v.slice(3).trim()}`); return; }
    if (v.startsWith("tag:")) { onTagSearch?.(v.slice(4).trim()); return; }
    saveRecent(v);
    setRecent(getRecent());
  }

  const showDropdown = focused && !value && (recent.length > 0 || POPULAR_TAGS.length > 0);

  return (
    <div ref={containerRef} className="relative">
      <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] border transition-colors duration-150
        bg-[var(--surface0)]
        ${focused
          ? "border-[var(--accent)]/50 ring-2 ring-[var(--focus)]"
          : "border-[var(--border)] hover:border-[var(--accent)]/25"}`}>
        <Search className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search agents, capabilities, @handle, or address…"
          className="flex-1 bg-transparent text-[14px] text-[var(--text-primary)]
            placeholder:text-[var(--text-muted)] outline-none"
        />
        {value ? (
          <button onClick={() => onChange("")}
            className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <kbd className="flex-shrink-0 text-[11px] text-[var(--text-muted)]
            bg-[var(--surface1)] border border-[var(--border)]
            px-1.5 py-0.5 rounded-[4px] font-sans tracking-tight">
            ⌘K
          </kbd>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1.5 rounded-[10px]
          bg-[var(--bg1)] border border-[var(--border)]
          shadow-[0_4px_16px_rgba(15,23,42,0.10)] z-50 overflow-hidden">

          {recent.length > 0 && (
            <div className="p-2">
              <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider px-2 py-1">
                Recent
              </p>
              {recent.map(r => (
                <button key={r} onClick={() => { onChange(r); setFocused(false); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[6px]
                    text-[13px] text-[var(--text-secondary)]
                    hover:bg-[var(--surface1)] hover:text-[var(--text-primary)]
                    transition-colors text-left">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                  <span className="truncate">{r}</span>
                </button>
              ))}
            </div>
          )}

          <div className={`p-2 ${recent.length > 0 ? "border-t border-[var(--border)]" : ""}`}>
            <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider px-2 py-1">
              Popular
            </p>
            <div className="flex flex-wrap gap-1.5 px-2 pb-1.5">
              {POPULAR_TAGS.map(tag => (
                <button key={tag} onClick={() => { onTagSearch?.(tag); setFocused(false); }}
                  className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-[12px]
                    text-[var(--text-secondary)] bg-[var(--surface1)] border border-[var(--border)]
                    hover:border-[var(--accent)]/30 hover:text-[var(--accent)] transition-colors">
                  <Hash className="w-2.5 h-2.5 opacity-60" />
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
