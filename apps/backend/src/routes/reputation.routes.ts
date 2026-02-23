import { Router } from "express";
import { reputationService } from "../services/reputation.service.js";
import { logger } from "../logger.js";
import { Contract, nativeToScVal, TransactionBuilder, Networks } from "@stellar/stellar-sdk";
import { Server, assembleTransaction } from "@stellar/stellar-sdk/rpc";
import { config } from "../config.js";

export const reputationRoutes = Router();

const rpc = new Server(config.STELLAR_RPC_URL);

reputationRoutes.get("/:agentId/summary", async (req, res) => {
  const agentId = parseInt(req.params.agentId);
  if (isNaN(agentId)) {
    return res.status(400).json({ error: "Invalid agent ID" });
  }
  try {
    const summary = await reputationService.getSummary(agentId);
    res.json(summary);
  } catch (err) {
    logger.error("Failed to get reputation summary", { agentId, error: err });
    res.json({ total_reviews: 0, avg_score_x100: 0, category_counts: 0, total_score: 0 });
  }
});

reputationRoutes.get("/:agentId/feedback", async (req, res) => {
  const agentId = parseInt(req.params.agentId);
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = parseInt(req.query.limit as string) || 10;
  if (isNaN(agentId)) {
    return res.status(400).json({ error: "Invalid agent ID" });
  }
  try {
    const feedback = await reputationService.getFeedback(agentId, offset, limit);
    res.json({ agentId, feedback, offset, limit });
  } catch (err) {
    logger.error("Failed to get feedback", { agentId, error: err });
    res.json({ agentId, feedback: [], offset, limit });
  }
});

/**
 * POST /api/reputation/:agentId/feedback
 * Build a post_feedback transaction for user to sign
 */
reputationRoutes.post("/:agentId/feedback", async (req, res) => {
  const agentId = parseInt(req.params.agentId);
  const { reviewer, score, category, dataUri, paymentProofHash } = req.body;

  if (isNaN(agentId) || !reviewer || !score || !category) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (score < 1 || score > 5) {
    return res.status(400).json({ error: "Score must be 1-5" });
  }

  try {
    const contract = new Contract(config.REPUTATION_REGISTRY_ADDRESS);
    const account = await rpc.getAccount(reviewer);

    const tx = new TransactionBuilder(account, {
      fee: "1000000",
      networkPassphrase: Networks.PUBLIC,
    })
      .addOperation(
        contract.call(
          "post_feedback",
          nativeToScVal(agentId, { type: "u32" }),
          nativeToScVal(reviewer, { type: "address" }),
          nativeToScVal(score, { type: "u32" }),
          nativeToScVal(category, { type: "string" }),
          nativeToScVal(dataUri || "", { type: "string" }),
          nativeToScVal(paymentProofHash || "", { type: "string" }),
        )
      )
      .setTimeout(60)
      .build();

    const sim = await rpc.simulateTransaction(tx);
    if (!("result" in sim)) {
      return res.status(400).json({ error: "Simulation failed" });
    }

    const assembled = assembleTransaction(tx, sim).build();
    res.json({ xdr: assembled.toXDR() });
  } catch (err: any) {
    logger.error("Failed to build feedback transaction", { agentId, error: err.message });
    res.status(500).json({ error: err.message });
  }
});
