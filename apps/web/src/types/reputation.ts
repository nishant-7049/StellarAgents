export interface FeedbackSummary {
  total_reviews: number;
  avg_score_x100: number;
  category_counts: number;
  total_score: number;
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
