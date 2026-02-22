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
          handle: agent.handle || null,
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
      handle: (agent as any).handle || null,
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

/**
 * GET /api/explorer/agents/:agentId/stats
 * Aggregated statistics for an agent — feeds the charts on the profile page.
 *
 * Returns:
 * - totals: { queries, usdcSpent, daysActive, avgDailyQueries }
 * - daily: last 30 days of { date, queries, usdcSpent }
 * - actions: breakdown by memo type { yield_query, rebalance, ... }
 */
explorerRoutes.get("/agents/:agentId/stats", async (req, res) => {
  const agentId = parseInt(req.params.agentId);
  if (isNaN(agentId)) return res.status(400).json({ error: "invalid agentId" });

  try {
    const agent = await agentService.getAgent(agentId);
    if (!agent) return res.status(404).json({ error: "Agent not found" });

    const horizonUrl = config.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";

    // Fetch up to 200 operations from Horizon for the vault
    let ops: any[] = [];
    try {
      const resp = await fetch(
        `${horizonUrl}/accounts/${agent.vault_address}/operations?limit=200&order=desc`
      );
      if (resp.ok) {
        const data = await resp.json() as any;
        ops = data._embedded?.records || [];
      }
    } catch {
      // Horizon unavailable — return zeros
    }

    // Decode ops and filter to x402 payments (invoke_host_function)
    const payments = ops
      .filter(op => op.type === "invoke_host_function")
      .map(op => {
        const ts = new Date(op.created_at);
        // Try to extract memo / action from function params
        const params = op.parameters || [];
        let memo = "query";
        for (const p of params) {
          const v = p?.value || "";
          if (typeof v === "string" && v.length > 2 && v.length < 30 && /^[a-z_]+$/.test(v)) {
            memo = v;
            break;
          }
        }
        // Extract amount from params (4th param = amount in stroops)
        let amount = 100_000; // default 0.01 USDC
        for (const p of params) {
          const v = parseInt(p?.value);
          if (!isNaN(v) && v > 0 && v < 100_000_000_000) {
            amount = v;
            break;
          }
        }
        return { ts, memo, amount, txHash: op.transaction_hash };
      });

    // If no real data from Horizon, generate realistic mock stats seeded by agentId
    const usesMock = payments.length === 0;
    const mockPayments = usesMock ? generateMockStats(agentId, agent.registered_at) : payments;
    const allPayments = usesMock ? mockPayments : payments;

    // Daily aggregation — last 30 days
    const dailyMap = new Map<string, { queries: number; usdcSpent: number }>();
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dailyMap.set(d.toISOString().slice(0, 10), { queries: 0, usdcSpent: 0 });
    }
    for (const p of allPayments) {
      const day = p.ts.toISOString().slice(0, 10);
      if (dailyMap.has(day)) {
        const existing = dailyMap.get(day)!;
        existing.queries += 1;
        existing.usdcSpent += p.amount / 1e7;
      }
    }
    const daily = Array.from(dailyMap.entries()).map(([date, v]) => ({
      date,
      queries: v.queries,
      usdcSpent: parseFloat(v.usdcSpent.toFixed(4)),
    }));

    // Action breakdown by memo
    const actionMap = new Map<string, number>();
    for (const p of allPayments) {
      const key = p.memo;
      actionMap.set(key, (actionMap.get(key) || 0) + 1);
    }
    const actions = Array.from(actionMap.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count);

    // Totals
    const totalQueries = allPayments.length;
    const totalUsdcSpent = allPayments.reduce((s, p) => s + p.amount / 1e7, 0);
    const registeredTs = Number(agent.registered_at) * 1000;
    const daysActive = Math.max(1, Math.floor((Date.now() - registeredTs) / 86400000));

    res.json({
      agentId,
      isMock: usesMock,
      totals: {
        queries: totalQueries,
        usdcSpent: parseFloat(totalUsdcSpent.toFixed(4)),
        daysActive,
        avgDailyQueries: parseFloat((totalQueries / daysActive).toFixed(1)),
      },
      daily,
      actions,
    });
  } catch (err: any) {
    logger.error("Explorer agent stats failed", { agentId, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * Generate realistic mock stats when Horizon data isn't available.
 * Seeded by agentId so each agent gets different-looking data.
 */
function generateMockStats(agentId: number, registeredAt: number) {
  const seed = agentId * 7;
  const memos = ["yield_query", "rebalance", "portfolio_check", "yield_query", "yield_query", "strategy_update"];
  const result: { ts: Date; memo: string; amount: number }[] = [];
  const now = Date.now();
  const regMs = Number(registeredAt) * 1000;
  const daysActive = Math.max(1, Math.floor((now - regMs) / 86400000));
  const activeDays = Math.min(daysActive, 30);

  for (let d = 0; d < activeDays; d++) {
    const dayTs = new Date(now - d * 86400000);
    const queriesThisDay = ((seed + d) % 5) + 1;
    for (let q = 0; q < queriesThisDay; q++) {
      const hourOffset = ((seed + d + q) % 20) * 3600000;
      result.push({
        ts: new Date(dayTs.getTime() - hourOffset),
        memo: memos[(seed + d + q) % memos.length],
        amount: 100_000, // 0.01 USDC
      });
    }
  }
  return result;
}
