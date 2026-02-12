"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface QueryInputProps {
  onSubmit: (query: string, risk: string) => void;
  loading?: boolean;
}

export function QueryInput({ onSubmit, loading }: QueryInputProps) {
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("moderate");

  const handleSubmit = () => {
    if (!query.trim()) return;
    onSubmit(query, risk);
    setQuery("");
  };

  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
          placeholder="Ask about yield strategies..."
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </div>
      <select
        value={risk}
        onChange={e => setRisk(e.target.value)}
        className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-3 text-sm text-white"
      >
        <option value="low">Low Risk</option>
        <option value="moderate">Moderate</option>
        <option value="high">High Risk</option>
      </select>
      <Button onClick={handleSubmit} disabled={loading || !query.trim()}>
        {loading ? "Querying..." : "Send"}
      </Button>
    </div>
  );
}
