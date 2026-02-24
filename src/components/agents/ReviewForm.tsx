"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Star } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { signAndSubmit } from "@/lib/stellar";
import { getTxUrl } from "@/lib/stellar";

interface ReviewFormProps {
  agentId: number;
  agentName: string;
  paymentTxHash?: string;
  onSuccess?: () => void;
}

const categories = [
  { value: "accuracy", label: "Accuracy" },
  { value: "speed", label: "Speed" },
  { value: "helpfulness", label: "Helpfulness" },
  { value: "cost", label: "Value for Money" },
];

export function ReviewForm({ agentId, agentName, paymentTxHash, onSuccess }: ReviewFormProps) {
  const { address } = useWallet();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [category, setCategory] = useState("accuracy");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address || rating === 0) return;

    setSubmitting(true);
    setTxHash(null);

    try {
      // Build review data URI (JSON)
      const reviewData = {
        comment: comment.trim(),
        timestamp: new Date().toISOString(),
      };
      const dataUri = JSON.stringify(reviewData);

      // Call backend to build transaction
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const response = await fetch(`${BACKEND_URL}/api/reputation/${agentId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewer: address,
          score: rating,
          category,
          dataUri,
          paymentProofHash: paymentTxHash || "",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to build review transaction");
      }

      const { xdr } = await response.json();

      // Sign and submit
      const hash = await signAndSubmit(xdr);
      setTxHash(hash);

      // Reset form
      setRating(0);
      setCategory("accuracy");
      setComment("");

      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Submit review failed:", err);
      alert(`Failed to submit review: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (txHash) {
    return (
      <Card className="p-6 text-center space-y-4">
        <div className="text-4xl">✓</div>
        <h3 className="text-lg font-bold text-green-400">Review Submitted!</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          Your {rating}-star review for {agentName} has been posted on-chain.
        </p>
        <a
          href={getTxUrl(txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-indigo-400 hover:text-indigo-300 underline"
        >
          View Transaction
        </a>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold mb-4">Review {agentName}</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Star Rating */}
        <div>
          <label className="block text-sm font-medium mb-2">Rating *</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-8 h-8 ${
                    star <= (hoveredRating || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-600"
                  }`}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {rating} star{rating !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium mb-2">Category *</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Comment */}
        <div>
          <label className="block text-sm font-medium mb-2">Comment (optional)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience with this agent..."
            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            rows={3}
            maxLength={500}
          />
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {comment.length}/500 characters
          </p>
        </div>

        {/* Payment Proof */}
        {paymentTxHash && (
          <div className="text-xs text-[var(--text-secondary)]">
            Payment verified: <span className="font-mono">{paymentTxHash.slice(0, 8)}...</span>
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          disabled={!address || rating === 0 || submitting}
          className="w-full"
        >
          {submitting ? "Submitting..." : "Submit Review"}
        </Button>

        {!address && (
          <p className="text-xs text-amber-400 text-center">
            Connect your wallet to submit a review
          </p>
        )}
      </form>
    </Card>
  );
}
