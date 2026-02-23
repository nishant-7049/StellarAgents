"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { fetchAPI } from "@/lib/api";
import { CATEGORIES } from "@/components/explorer/FilterChips";

export interface Agent {
  id: number;
  owner: string;
  name: string;
  handle: string | null;
  isActive: boolean;
  capabilities: string[];
  pricing: { amount: string; protocol: string } | null;
  model: string | null;
  reputation?: { totalReviews: number; avgScore: number } | null;
  registeredAt: number;
}

export interface TrendingAgent extends Agent {
  stats: {
    calls7d: number;
    unique7d: number;
    calls30d: number;
    fees30d: number;
    trendingScore: number;
  };
}

export interface TrendingData {
  trending: TrendingAgent | null;
  top_grossing: TrendingAgent | null;
  isMock: boolean;
}

export interface GraphPoint {
  date: string;
  calls: number;
  fees: number;
}

export interface Facets {
  verified?: boolean;
  network?: "all" | "testnet" | "mainnet";
  pricing?: "all" | "free" | "credits";
  status?: "all" | "active" | "inactive";
}

export type SortOrder = "trending" | "grossing" | "newest";

/** Expand category labels to their underlying tag keywords */
function categoryToTags(labels: string[]): string[] {
  const out: string[] = [];
  for (const label of labels) {
    const cat = CATEGORIES.find(c => c.label === label);
    if (cat) out.push(...cat.tags);
    else out.push(label.toLowerCase());
  }
  return [...new Set(out)];
}

export function useExplorer() {
  const searchParams = useSearchParams();

  // Pre-populate query from URL ?q=, ?addr=, ?handle=
  const initialQuery = (() => {
    const q = searchParams.get("q");
    const addr = searchParams.get("addr");
    const handle = searchParams.get("handle");
    if (addr) return addr;
    if (handle) return `@${handle}`;
    return q ?? "";
  })();

  const [query, setQuery] = useState(initialQuery);
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [facets, setFacets] = useState<Facets>({ network: "all", pricing: "all", status: "all" });
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortOrder>("trending");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [totalAgents, setTotalAgents] = useState(0);
  const [trending, setTrending] = useState<TrendingData | null>(null);
  const [graphData, setGraphData] = useState<GraphPoint[]>([]);
  const [graphMetric, setGraphMetric] = useState<"calls" | "fees">("calls");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch trending + graph on mount
  useEffect(() => {
    fetchAPI<TrendingData>("/api/explorer/trending")
      .then(d => setTrending(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchAPI<{ data: GraphPoint[] }>(`/api/explorer/graph?metric=${graphMetric}`)
      .then(d => setGraphData(d.data))
      .catch(() => {});
  }, [graphMetric]);

  const fetchAgents = useCallback(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (query) params.set("q", query);

    // Expand category labels → keyword tags and merge with customTags
    const categoryTags = categoryToTags(activeCategories);
    const allTags = [...categoryTags, ...customTags];
    if (allTags.length) params.set("tags", allTags.join(","));

    if (facets.pricing && facets.pricing !== "all") params.set("pricing", facets.pricing);
    if (facets.status && facets.status !== "all") params.set("status", facets.status);
    if (facets.network && facets.network !== "all") params.set("network", facets.network);
    params.set("sort", sort === "grossing" ? "grossing" : sort);
    params.set("limit", "30");

    fetchAPI<{ agents: Agent[]; total: number }>(`/api/explorer/search?${params.toString()}`)
      .then(d => {
        setAgents(d.agents);
        setTotalAgents(d.total);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [query, activeCategories, customTags, facets, sort]);

  // Debounced fetch on filter/search changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchAgents, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fetchAgents]);

  function toggleCategory(cat: string) {
    setActiveCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  }

  function setFacet<K extends keyof Facets>(key: K, value: Facets[K]) {
    setFacets(prev => ({ ...prev, [key]: value }));
  }

  function addCustomTag(tag: string) {
    const t = tag.trim();
    if (t && !customTags.includes(t)) setCustomTags(prev => [...prev, t]);
  }

  function removeCustomTag(tag: string) {
    setCustomTags(prev => prev.filter(t => t !== tag));
  }

  return {
    query, setQuery,
    activeCategories, toggleCategory,
    facets, setFacet,
    customTags, addCustomTag, removeCustomTag,
    sort, setSort,
    agents, totalAgents,
    trending,
    graphData, graphMetric, setGraphMetric,
    loading, error,
    refetch: fetchAgents,
  };
}
