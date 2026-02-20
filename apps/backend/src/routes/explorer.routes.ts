import { Router } from "express";
import { agentService } from "../services/agent.service.js";
import { reputationService } from "../services/reputation.service.js";
import { decodeHorizonOperation } from "../utils/event-decoder.js";
import { logger } from "../logger.js";
import { config } from "../config.js";

export const explorerRoutes = Router();

/**
 * GET /api/explorer/activity
 * Global decoded activity feed across all contracts.
 */
explorerRoutes.get("/activity", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);

  try {
    const horizonUrl = config.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";
    const decoded: any[] = [];

    // Fetch operations for the vault factory and agent registry
    const contractIds = [
      config.VAULT_FACTORY_ADDRESS,
      config.AGENT_REGISTRY_ADDRESS,
    ].filter(Boolean);

    for (const contractId of contractIds) {
      try {
        const resp = await fetch(
          `${horizonUrl}/accounts/${contractId}/operations?limit=${Math.ceil(limit / contractIds.length)}&order=desc`
        );
        if (!resp.ok) continue;
        const data = await resp.json() as any;
        const ops = data._embedded?.records || [];
        for (const op of ops) {
          decoded.push(decodeHorizonOperation(op));
        }
      } catch {
        // skip unavailable contracts
      }
    }

    // Sort by timestamp descending
    decoded.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      activity: decoded.slice(0, limit),
      count: decoded.length,
    });
  } catch (err: any) {
    logger.error("Explorer activity failed", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/explorer/agents
 * All registered agents with decoded metadata and reputation summary.
 */
explorerRoutes.get("/agents", async (req, res) => {
  const startId = parseInt(req.query.startId as string || "1");
  const limit = Math.min(parseInt(req.query.limit as string || "20"), 50);

  try {
    const agents = await agentService.listAgents(startId, limit);

    // Enrich with reputation data
    const enriched = await Promise.all(
      agents.map(async (agent: any) => {
        let reputation = null;
        try {
          reputation = await reputationService.getSummary(agent.id);
        } catch {
          // no reputation yet
        }

        // Decode agent_uri JSON
        let capabilities: string[] = [];
        let pricing: any = null;
        let model: string | null = null;
        try {
          const uri = typeof agent.agent_uri === "string"
            ? JSON.parse(agent.agent_uri)
            : agent.agent_uri;
          capabilities = uri?.capabilities || [];
          pricing = uri?.pricing || null;
          model = uri?.model || null;
        } catch {
          // malformed URI
        }

        return {
          id: agent.id,
          owner: agent.owner,
          name: agent.name,
          vaultAddress: agent.vault_address,
          agentSigner: agent.agent_signer,
          registeredAt: agent.registered_at,
          isActive: agent.is_active,
          capabilities,
          pricing,
          model,
          reputation: reputation
            ? {
                totalReviews: reputation.total_reviews,
                avgScore: reputation.avg_score_x100 / 100,
              }
            : null,
        };
      })
    );

    const total = await agentService.getAgentCount();

    res.json({
      agents: enriched,
      total,
      page: { startId, limit },
    });
  } catch (err: any) {
    logger.error("Explorer agents failed", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/explorer/agents/:agentId
 * Full agent profile: details, capabilities, reputation, decoded payment history.
 */
explorerRoutes.get("/agents/:agentId", async (req, res) => {
  const agentId = parseInt(req.params.agentId);
  if (isNaN(agentId)) return res.status(400).json({ error: "invalid agentId" });

  try {
    const agent = await agentService.getAgent(agentId);
    if (!agent) return res.status(404).json({ error: "Agent not found" });

    // Decode agent_uri
    let capabilities: string[] = [];
    let pricing: any = null;
    let model: string | null = null;
    let endpoints: any = null;
    try {
      const uri = typeof agent.agent_uri === "string"
        ? JSON.parse(agent.agent_uri)
        : agent.agent_uri;
      capabilities = uri?.capabilities || [];
      pricing = uri?.pricing || null;
      model = uri?.model || null;
      endpoints = uri?.endpoints || null;
    } catch {
      // malformed URI
    }

    // Get reputation summary + feedback
    let reputation = null;
    let feedback: any[] = [];
    try {
      reputation = await reputationService.getSummary(agentId);
      const feedbackData = await reputationService.getFeedback(agentId, 0, 10);
      feedback = feedbackData || [];
    } catch {
      // no reputation
    }

    // Get payment history from Horizon
    const horizonUrl = config.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";
    let paymentHistory: any[] = [];
    try {
      const resp = await fetch(
        `${horizonUrl}/accounts/${agent.vault_address}/operations?limit=20&order=desc`
      );
      if (resp.ok) {
        const data = await resp.json() as any;
        paymentHistory = (data._embedded?.records || []).map(decodeHorizonOperation);
      }
    } catch {
      // history unavailable
    }

    res.json({
      id: agent.id,
      owner: agent.owner,
      name: agent.name,
      agentUri: agent.agent_uri,
      vaultAddress: agent.vault_address,
      agentSigner: agent.agent_signer,
      registeredAt: agent.registered_at,
      isActive: agent.is_active,
      capabilities,
      pricing,
      model,
      endpoints,
      reputation: reputation
        ? {
            totalReviews: reputation.total_reviews,
            totalScore: reputation.total_score,
            avgScore: reputation.avg_score_x100 / 100,
          }
        : null,
      feedback,
      paymentHistory,
    });
  } catch (err: any) {
    logger.error("Explorer agent detail failed", { agentId, error: err.message });
    res.status(500).json({ error: err.message });
  }
});
