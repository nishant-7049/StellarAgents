import { nativeToScVal } from "@stellar/stellar-sdk";
import { ContractReader } from "./contract-reader.js";
import type { StellarClientConfig, FeedbackSummary, Feedback, LoggerLike } from "./types.js";

/**
 * Read-only client for the ReputationRegistry contract.
 */
export class ReputationRegistry {
  private reader: ContractReader;
  private reputationAddress: string;

  constructor(reputationAddress: string, config: StellarClientConfig, logger?: LoggerLike) {
    this.reputationAddress = reputationAddress;
    this.reader = new ContractReader(config, logger);
  }

  /** Get the feedback summary for an agent. */
  async getSummary(agentId: number): Promise<FeedbackSummary> {
    const result = await this.reader.readContractValue(
      this.reputationAddress,
      "get_feedback_summary",
      [nativeToScVal(agentId, { type: "u32" })],
    );
    return result || { total_reviews: 0, avg_score_x100: 0, category_counts: 0, total_score: 0 };
  }

  /** Get paginated feedback entries for an agent. */
  async getFeedback(agentId: number, offset: number = 0, limit: number = 10): Promise<Feedback[]> {
    const result = await this.reader.readContractValue(
      this.reputationAddress,
      "get_feedback",
      [
        nativeToScVal(agentId, { type: "u32" }),
        nativeToScVal(offset, { type: "u32" }),
        nativeToScVal(limit, { type: "u32" }),
      ],
    );
    return result || [];
  }
}
