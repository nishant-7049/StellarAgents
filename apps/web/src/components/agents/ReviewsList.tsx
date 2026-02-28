"use client";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Star } from "lucide-react";
import { shortenAddress } from "@/lib/stellar";

interface Review {
  agent_id: number;
  reviewer: string;
  score: number;
  category: string;
  data_uri: string;
  payment_proof_hash: string;
  timestamp: number;
}

interface ReviewsListProps {
  agentId: number;
}

export function ReviewsList({ agentId }: ReviewsListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<{
    total_reviews: number;
    avg_score_x100: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReviews();
  }, [agentId]);

  async function loadReviews() {
    setLoading(true);
    try {
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

      // Load summary
      const summaryRes = await fetch(`${BACKEND_URL}/api/reputation/${agentId}/summary`);
      const summaryData = await summaryRes.json();
      setSummary(summaryData);

      // Load feedback
      const feedbackRes = await fetch(`${BACKEND_URL}/api/reputation/${agentId}/feedback?limit=20`);
      const feedbackData = await feedbackRes.json();
      setReviews(feedbackData.feedback || []);
    } catch (err) {
      console.error("Failed to load reviews:", err);
    } finally {
      setLoading(false);
    }
  }

  function parseComment(dataUri: string): string {
    try {
      const data = JSON.parse(dataUri);
      return data.comment || "";
    } catch {
      return "";
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  const avgScore = summary ? summary.avg_score_x100 / 100 : 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      {summary && summary.total_reviews > 0 && (
        <Card className="p-4 flex items-center gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-400">{avgScore.toFixed(1)}</div>
            <div className="flex gap-0.5 justify-center mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${
                    star <= Math.round(avgScore)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-600"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="text-sm text-[var(--text-secondary)]">
            Based on {summary.total_reviews} review{summary.total_reviews !== 1 ? "s" : ""}
          </div>
        </Card>
      )}

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <Card className="p-6 text-center text-sm text-[var(--text-secondary)]">
          No reviews yet. Be the first to review this agent!
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((review, index) => {
            const comment = parseComment(review.data_uri);
            return (
              <Card key={index} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= review.score
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-600"
                          }`}
                        />
                      ))}
                    </div>
                    <Badge variant="default">{review.category}</Badge>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {new Date(review.timestamp * 1000).toLocaleDateString()}
                  </div>
                </div>

                {comment && (
                  <p className="text-sm text-[var(--text-secondary)] mb-2">"{comment}"</p>
                )}

                <div className="text-xs text-[var(--text-secondary)] font-mono">
                  by {shortenAddress(review.reviewer, 6)}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
