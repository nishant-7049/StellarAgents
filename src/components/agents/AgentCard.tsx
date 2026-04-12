"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ReputationBadge } from "./ReputationBadge";
import { ReviewForm } from "./ReviewForm";
import { ReviewsList } from "./ReviewsList";
import { useReputation } from "@/hooks/useReputation";
import { MessageSquare, Star } from "lucide-react";

interface AgentCardProps {
  agent: { id: number; name: string; capabilities?: string[]; pricing?: { amount: string }; status?: string };
}

export function AgentCard({ agent }: AgentCardProps) {
  const { summary, loadSummary } = useReputation(agent.id);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showReviewsDialog, setShowReviewsDialog] = useState(false);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  return (
    <>
      <Card glow className="hover:border-indigo-500/50 transition-colors">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold">{agent.name}</h3>
          <Badge variant={agent.status === "active" ? "success" : "default"}>{agent.status || "active"}</Badge>
        </div>
        <div className="flex flex-wrap gap-1 mb-3">
          {agent.capabilities?.map(c => <Badge key={c} variant="info">{c}</Badge>)}
        </div>
        <div className="flex items-center justify-between mb-3">
          {agent.pricing && (
            <div className="text-sm text-[var(--text-secondary)]">
              {(parseInt(agent.pricing.amount) / 10_000_000).toFixed(2)} USDC per query
            </div>
          )}
          <ReputationBadge summary={summary} />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowReviewsDialog(true)}
            className="flex-1 flex items-center justify-center gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Reviews
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowReviewDialog(true)}
            className="flex-1 flex items-center justify-center gap-1.5"
          >
            <Star className="w-3.5 h-3.5" />
            Write Review
          </Button>
        </div>
      </Card>

      {/* Review Dialog */}
      <Dialog
        open={showReviewDialog}
        onClose={() => setShowReviewDialog(false)}
        title="Write a Review"
      >
        <ReviewForm
          agentId={agent.id}
          agentName={agent.name}
          onSuccess={() => {
            setShowReviewDialog(false);
            loadSummary();
          }}
        />
      </Dialog>

      {/* Reviews List Dialog */}
      <Dialog
        open={showReviewsDialog}
        onClose={() => setShowReviewsDialog(false)}
        title={`Reviews for ${agent.name}`}
      >
        <ReviewsList agentId={agent.id} />
      </Dialog>
    </>
  );
}
