"use client";
import { useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useReputation } from "@/hooks/useReputation";

interface FeedbackListProps {
  agentId: number;
}

export function FeedbackList({ agentId }: FeedbackListProps) {
  const { feedback, loading, loadFeedback } = useReputation(agentId);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  if (loading) {
    return <div className="text-[var(--text-secondary)] text-sm">Loading feedback...</div>;
  }

  if (feedback.length === 0) {
    return <div className="text-[var(--text-secondary)] text-sm">No feedback yet</div>;
  }

  return (
    <div className="space-y-2">
      {feedback.map((fb, i) => (
        <Card key={i} className="p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-yellow-400">
                {"\u2605".repeat(fb.score)}{"\u2606".repeat(5 - fb.score)}
              </span>
              <Badge variant="info">{fb.category}</Badge>
            </div>
            <span className="text-xs text-[var(--text-secondary)]">
              {new Date(fb.timestamp * 1000).toLocaleDateString()}
            </span>
          </div>
          <div className="text-xs text-[var(--text-secondary)] truncate">
            Reviewer: {fb.reviewer.slice(0, 8)}...{fb.reviewer.slice(-4)}
          </div>
        </Card>
      ))}
    </div>
  );
}
