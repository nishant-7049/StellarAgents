"use client";
import { Badge } from "@/components/ui/Badge";
import type { FeedbackSummary } from "@/types/reputation";

interface ReputationBadgeProps {
  summary: FeedbackSummary | null;
}

export function ReputationBadge({ summary }: ReputationBadgeProps) {
  if (!summary || summary.total_reviews === 0) {
    return <Badge variant="default">No reviews</Badge>;
  }

  const avgScore = summary.avg_score_x100 / 100;
  const stars = Math.round(avgScore);
  const starDisplay = "\u2605".repeat(stars) + "\u2606".repeat(5 - stars);

  const variant = avgScore >= 4 ? "success" : avgScore >= 3 ? "info" : "default";

  return (
    <Badge variant={variant}>
      {starDisplay} {avgScore.toFixed(1)} ({summary.total_reviews})
    </Badge>
  );
}
