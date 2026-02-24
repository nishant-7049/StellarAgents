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
