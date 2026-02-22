// ── Stellar Client Config ──

export interface StellarClientConfig {
  rpcUrl: string;
  networkPassphrase: string;
  /** Public key of a funded account used as source for read-only simulations. */
  simulationSourceKey?: string;
}

// ── Vault Types ──

export interface AgentPolicy {
  agent_address: string;
  daily_limit: string;
  spent_today: string;
  last_reset: number;
  allowed_destinations: string[];
  is_active: boolean;
}

// ── Agent Types ──

export interface AgentInfo {
  token_id: number;
  owner: string;
  name: string;
  handle: string;
  agent_uri: string;
  vault_address: string;
  agent_signer: string;
  registered_at: number;
  updated_at: number;
  is_active: boolean;
}

// ── Reputation Types ──

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

// ── Validation Types ──

export interface Validation {
  request_id: number;
  agent_id: number;
  validator: string;
  request_uri: string;
  data_hash: string;
  status: "Pending" | "Completed" | "Failed";
  success: boolean;
  evidence_uri: string;
  requested_at: number;
  completed_at: number;
}

// ── Logger ──

export interface LoggerLike {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}
