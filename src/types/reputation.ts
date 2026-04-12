export interface FeedbackSummary {
  total_reviews: number;
  total_score: number;
  avg_score_x100: number;  // score * 100 for 2 decimal precision (e.g., 4.35 = 435)
}

export interface Feedback {
  agent_id: number;
  reviewer: string;
  score: number;
  category: string;
  data_uri: string;
  payment_proof_hash: string;
  timestamp: number;
}
