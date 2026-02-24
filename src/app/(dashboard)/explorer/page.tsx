"use client";
import { Suspense } from "react";
import { useExplorer } from "@/hooks/useExplorer";
import { SearchBar } from "@/components/explorer/SearchBar";
import { FilterChips } from "@/components/explorer/FilterChips";
import { TrendingRow } from "@/components/explorer/TrendingCard";
import { GraphCard } from "@/components/explorer/GraphCard";
import { AgentRow, AgentRowSkeleton } from "@/components/explorer/AgentRow";
import { EmptyState } from "@/components/explorer/EmptyState";

function ExplorerContent() {
  const {
    query, setQuery,
    activeCategories, toggleCategory,
    facets, setFacet,
    customTags, addCustomTag, removeCustomTag,
    sort, setSort,
    agents, totalAgents,
    trending,
    graphData, graphMetric, setGraphMetric,
    loading, error, refetch,
  } = useExplorer();

  const isFiltering = query || activeCategories.length > 0 || customTags.length > 0;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div>
        <h1 className="text-[22px] font-bold text-[var(--text-primary)]">Explorer</h1>
        <p className="text-[14px] text-[var(--text-muted)] mt-0.5">
          Discover AI agents on Stellar
          {totalAgents > 0 && (
            <> · <span className="text-[var(--accent)] font-medium">{totalAgents} registered</span></>
          )}
        </p>
      </div>

      {/* Search */}
      <SearchBar
        value={query}
        onChange={setQuery}
        onTagSearch={tag => toggleCategory(tag)}
      />

      {/* Filters */}
      <FilterChips
        activeCategories={activeCategories}
        onToggle={toggleCategory}
        facets={facets}
        onFacet={setFacet}
        customTags={customTags}
        onAddTag={addCustomTag}
        onRemoveTag={removeCustomTag}
        sort={sort}
        onSort={setSort}
      />

      {/* Trending + Graph — only shown when not filtering */}
      {!isFiltering && (
        <>
          <TrendingRow trending={trending} />
          <GraphCard data={graphData} metric={graphMetric} onMetricChange={setGraphMetric} />
        </>
      )}

      {/* Agent List */}
      <div>
        <h2 className="text-[13px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
          {isFiltering ? "Search Results" : "All Agents"}
        </h2>
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <AgentRowSkeleton key={i} />)
          ) : error ? (
            <EmptyState isError onRetry={refetch} />
          ) : agents.length === 0 ? (
            <EmptyState query={query} />
          ) : (
            agents.map(agent => <AgentRow key={agent.id} agent={agent} />)
          )}
        </div>
      </div>
    </div>
  );
}

function ExplorerSkeleton() {
  return (
    <div className="space-y-5">
      <div>
        <div className="h-7 w-24 rounded skeleton mb-1" />
        <div className="h-4 w-48 rounded skeleton" />
      </div>
      <div className="h-11 rounded-[10px] skeleton" />
      <div className="flex gap-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 w-16 rounded-[6px] skeleton" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => <AgentRowSkeleton key={i} />)}
      </div>
    </div>
  );
}

export default function ExplorerPage() {
  return (
    <Suspense fallback={<ExplorerSkeleton />}>
      <ExplorerContent />
    </Suspense>
  );
}
