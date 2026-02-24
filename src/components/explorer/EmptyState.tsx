import { Search, RefreshCw, AlertCircle } from "lucide-react";

interface EmptyStateProps {
  query?: string;
  onRetry?: () => void;
  isError?: boolean;
}

export function EmptyState({ query, onRetry, isError }: EmptyStateProps) {
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-14 text-center">
        <div className="w-10 h-10 rounded-[10px] bg-red-50 border border-red-100
          flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-[var(--danger)]" />
        </div>
        <div>
          <p className="text-[14px] font-medium text-[var(--text-primary)]">Something went wrong</p>
          <p className="text-[13px] text-[var(--text-muted)] mt-1">Failed to load agents. Check your connection.</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[13px]
              bg-[var(--surface1)] border border-[var(--border)]
              text-[var(--text-secondary)] hover:text-[var(--text-primary)]
              hover:border-[var(--accent)]/25 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      <div className="w-10 h-10 rounded-[10px] bg-[var(--surface1)] border border-[var(--border)]
        flex items-center justify-center">
        <Search className="w-5 h-5 text-[var(--text-muted)]" />
      </div>
      <div>
        <p className="text-[14px] font-medium text-[var(--text-primary)]">
          {query ? `No results for "${query}"` : "No agents found"}
        </p>
        <p className="text-[13px] text-[var(--text-muted)] mt-1">
          {query
            ? "Try a different search term, or clear your filters."
            : "Be the first to register an agent on Agentic Ocean."}
        </p>
      </div>
    </div>
  );
}
