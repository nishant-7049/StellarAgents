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
        const tokenId = Number(agent.token_id ?? agent.id);
        let reputation = null;
        try {
          reputation = await reputationService.getSummary(tokenId);
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
          id: tokenId,
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
      id: Number((agent as any).token_id ?? (agent as any).id),
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
 * GET /api/explorer/search
 * Fuzzy search + facet filter over registered agents.
 */
explorerRoutes.get("/search", async (req, res) => {
  const q = ((req.query.q as string) || "").toLowerCase().trim();
  const tags = req.query.tags ? (req.query.tags as string).split(",").map(t => t.trim().toLowerCase()).filter(Boolean) : [];
  const network = (req.query.network as string) || "all";  // "testnet" | "mainnet" | "all"
  const pricing = (req.query.pricing as string) || "all";
  const status = (req.query.status as string) || "all";
  const sort = (req.query.sort as string) || "trending";
  const limit = Math.min(parseInt(req.query.limit as string || "20"), 50);
  const startId = parseInt(req.query.startId as string || "1");

  try {
    const agents = await agentService.listAgents(startId, 100);

    // Enrich agents
    const enriched = await Promise.all(
      agents.map(async (agent: any) => {
        const tokenId = Number(agent.token_id ?? agent.id);
        let capabilities: string[] = [];
        let pricing_info: any = null;
        let model: string | null = null;
        try {
          const uri = typeof agent.agent_uri === "string" ? JSON.parse(agent.agent_uri) : agent.agent_uri;
          capabilities = uri?.capabilities || [];
          pricing_info = uri?.pricing || null;
          model = uri?.model || null;
        } catch { /* malformed */ }

        let reputation = null;
        try {
          const rep = await reputationService.getSummary(tokenId);
          if (rep) reputation = { totalReviews: rep.total_reviews, avgScore: rep.avg_score_x100 / 100 };
        } catch { /* no reputation yet */ }

        return { id: tokenId, owner: agent.owner, name: agent.name, handle: agent.handle || null,
          vaultAddress: agent.vault_address, agentSigner: agent.agent_signer,
          registeredAt: agent.registered_at, isActive: agent.is_active,
          capabilities, pricing: pricing_info, model, reputation };
      })
    );

    // Filter
    let filtered = enriched.filter(a => {
      if (status === "active" && !a.isActive) return false;
      if (status === "inactive" && a.isActive) return false;

      // Network filter: agents registered on testnet have addresses starting with 'G'/'C' (Stellar)
      // For MVP all agents are on testnet; "mainnet" filter returns nothing yet
      if (network === "mainnet") return false; // no mainnet agents in MVP

      if (q) {
        const qLower = q.toLowerCase();
        const nameMatch = a.name.toLowerCase().includes(qLower);
        const capMatch = a.capabilities.some((c: string) => c.toLowerCase().includes(qLower));
        const handleMatch = a.handle && a.handle.toLowerCase().includes(qLower);
        const ownerMatch = a.owner.toLowerCase().includes(qLower);
        const vaultMatch = (a as any).vaultAddress && (a as any).vaultAddress.toLowerCase().includes(qLower);
        if (!nameMatch && !capMatch && !handleMatch && !ownerMatch && !vaultMatch) return false;
      }

      if (tags.length > 0) {
        const agentCaps = a.capabilities.map((c: string) => c.toLowerCase());
        // ANY of the requested tags must appear in ANY capability string
        const hasTag = tags.some(t => agentCaps.some((c: string) => c.includes(t)));
        if (!hasTag) return false;
      }

      if (pricing === "free" && a.pricing && parseInt(a.pricing.amount) > 0) return false;
      if (pricing === "credits" && (!a.pricing || parseInt(a.pricing.amount) === 0)) return false;

      return true;
    });

    // Sort
    if (sort === "newest") {
      filtered.sort((a, b) => Number(b.registeredAt) - Number(a.registeredAt));
    } else if (sort === "grossing") {
      filtered.sort((a, b) => {
        const aAmt = a.pricing ? parseInt(a.pricing.amount) : 0;
        const bAmt = b.pricing ? parseInt(b.pricing.amount) : 0;
        return bAmt - aAmt;
      });
    }
    // "trending" = default order (id-based for MVP)

    res.json({
      agents: filtered.slice(0, limit),
      total: filtered.length,
      query: q,
    });
  } catch (err: any) {
    logger.error("Explorer search failed", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/explorer/trending
 * Returns #1 trending (7d calls) and top grossing (30d fees) agents.
 * Tries Horizon first per agent; falls back to seeded mock if no on-chain data.
 */
explorerRoutes.get("/trending", async (req, res) => {
  try {
    const agents = await agentService.listAgents(1, 50);
    const horizonUrl = config.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";
    const now = Date.now();

    const enriched = await Promise.all(
      agents.map(async (agent: any) => {
        const tokenId = Number(agent.token_id ?? agent.id);
        let capabilities: string[] = [];
        let pricing_info: any = null;
        try {
          const uri = typeof agent.agent_uri === "string" ? JSON.parse(agent.agent_uri) : agent.agent_uri;
          capabilities = uri?.capabilities || [];
          pricing_info = uri?.pricing || null;
        } catch { /* malformed */ }

        const feePerCall = pricing_info ? parseInt(pricing_info.amount) / 1e7 : 0.01;

        // Try Horizon for real call counts
        let calls7d = 0, unique7d = 0, calls30d = 0, fees30d = 0;
        let usedMock = false;

        try {
          const resp = await fetch(
            `${horizonUrl}/accounts/${agent.vault_address}/operations?limit=200&order=desc`
          );
          if (resp.ok) {
            const data = await resp.json() as any;
            const ops = (data._embedded?.records || []) as any[];
            const invocations = ops.filter((op: any) => op.type === "invoke_host_function");
            if (invocations.length > 0) {
              const sevenDaysAgo = now - 7 * 86400000;
              const thirtyDaysAgo = now - 30 * 86400000;
              for (const op of invocations) {
                const ts = new Date(op.created_at).getTime();
                if (ts >= thirtyDaysAgo) {
                  calls30d++;
                  fees30d += feePerCall;
                  if (ts >= sevenDaysAgo) calls7d++;
                }
              }
              unique7d = Math.max(1, Math.floor(calls7d * 0.6));
              fees30d = parseFloat(fees30d.toFixed(4));
            } else {
              usedMock = true;
            }
          } else {
            usedMock = true;
          }
        } catch {
          usedMock = true;
        }

        // No mock fallback — agents with no Horizon data stay at 0
        const trendingScore = calls7d * 0.4 + unique7d * 0.35 + (calls7d / 50) * 0.25;

        return {
          id: tokenId, name: agent.name, handle: agent.handle || null,
          owner: agent.owner, isActive: agent.is_active,
          capabilities, pricing: pricing_info, usedMock,
          stats: { calls7d, unique7d, calls30d, fees30d, trendingScore },
        };
      })
    );

    const real = enriched.filter(a => a.isActive && (a.pricing !== null || a.capabilities.length > 0));

    if (real.length === 0) {
      return res.json({ trending: null, top_grossing: null, isMock: true });
    }

    const isMock = real.some(a => a.usedMock);
    const byTrending = [...real].sort((a, b) => b.stats.trendingScore - a.stats.trendingScore);
    const byGrossing = [...real].sort((a, b) => b.stats.fees30d - a.stats.fees30d);

    const trending = byTrending[0] || null;
    const top_grossing = byGrossing.find(a => a.id !== trending?.id) || byGrossing[0] || null;

    res.json({ trending, top_grossing, isMock });
  } catch (err: any) {
    logger.error("Explorer trending failed", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/explorer/graph
 * Ecosystem-wide daily aggregated stats (last 30 days).
 * Tries Horizon per agent; falls back to seeded mock if no on-chain data.
 */
explorerRoutes.get("/graph", async (req, res) => {
  const metric = (req.query.metric as string) || "calls";

  try {
    const agents = await agentService.listAgents(1, 50);
    const horizonUrl = config.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";
    const now = new Date();
    const dailyMap = new Map<string, { calls: number; fees: number }>();

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dailyMap.set(d.toISOString().slice(0, 10), { calls: 0, fees: 0 });
    }

    let anyMock = false;

    for (const agent of agents) {
      let pricing_info: any = null;
      try {
        const uri = typeof (agent as any).agent_uri === "string"
          ? JSON.parse((agent as any).agent_uri) : (agent as any).agent_uri;
        pricing_info = uri?.pricing || null;
      } catch { /* */ }
      const feePerCall = pricing_info ? parseInt(pricing_info.amount) / 1e7 : 0.01;

      // Try Horizon first
      let payments: { ts: Date; amount: number }[] = [];

      try {
        const resp = await fetch(
          `${horizonUrl}/accounts/${(agent as any).vault_address}/operations?limit=200&order=desc`
        );
        if (resp.ok) {
          const data = await resp.json() as any;
          const ops = (data._embedded?.records || []) as any[];
          const invocations = ops.filter((op: any) => op.type === "invoke_host_function");
          if (invocations.length > 0) {
            payments = invocations.map((op: any) => ({
              ts: new Date(op.created_at),
              amount: feePerCall,
            }));
          }
        }
      } catch { /* Horizon unavailable */ }

      if (payments.length === 0) {
        anyMock = true;
        // No Horizon data — leave payments empty (contributes 0s to the chart)
      }

      for (const p of payments) {
        const day = p.ts.toISOString().slice(0, 10);
        if (dailyMap.has(day)) {
          const entry = dailyMap.get(day)!;
          entry.calls += 1;
          entry.fees += p.amount;
        }
      }
    }

    const data = Array.from(dailyMap.entries()).map(([date, v]) => ({
      date: date.slice(5), // MM-DD
      calls: v.calls,
      fees: parseFloat(v.fees.toFixed(4)),
    }));

    res.json({ data, isMock: anyMock, metric });
  } catch (err: any) {
    logger.error("Explorer graph failed", { error: err.message });
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
