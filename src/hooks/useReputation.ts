"use client";
import { useState, useCallback } from "react";
import { fetchReputationSummary, fetchFeedback } from "@/lib/api";
import type { FeedbackSummary, Feedback } from "@/types/reputation";

export function useReputation(agentId: number) {
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSummary = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const data = await fetchReputationSummary(agentId);
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  const loadFeedback = useCallback(async (offset = 0, limit = 10) => {
    if (!agentId) return;
    setLoading(true);
    try {
      const data = await fetchFeedback(agentId, offset, limit);
      setFeedback(data.feedback || []);
    } catch {
      setFeedback([]);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  return { summary, feedback, loading, loadSummary, loadFeedback };
}
