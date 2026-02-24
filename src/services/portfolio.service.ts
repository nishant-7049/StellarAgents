/**
 * Portfolio Tracking Service
 *
 * Tracks where user funds are deployed across DeFi protocols.
 * All data is stored in MongoDB (portfolios collection).
 * Updated when users execute strategies or when the agent rebalances autonomously.
 */
import { logger } from "../logger.js";
import { PortfolioModel, IDeployedPosition, IRebalanceEvent } from "../db/portfolio.model.js";

export interface X402Payment {
  timestamp?: string;
  purpose: "yield_query" | "rebalance_check" | "execute" | "other";
  amountStroops: number;
  txHash?: string;
  status: "settled" | "unknown" | "failed";
}

export interface PortfolioSnapshot {
  timestamp?: string;
  vaultBalanceUsdc: number;
  totalDeployedUsdc: number;
  weightedApy: number;
  totalValueEstimate: number;
  source: "onchain" | "tracked";
}

export interface LastDecision {
  timestamp?: string;
  action: "rebalanced" | "skipped" | "error";
  reason: string;
  currentApy: number;
  targetApy?: number;
  improvement?: number;
}

// Re-export interface types for callers
export interface DeployedPosition {
  protocol: string;       // "Blend USDC", "Soroswap USDC/XLM", "Ondo USDY", etc.
  protocolKey: string;    // "blend" | "soroswap" | "ondo" | "defindex" | "idle"
  amountUsdc: number;     // decimal USDC (not stroops)
  allocationPct: number;  // 0-100
  entryApy: number;       // APY at time of deployment
  deployedAt: string;     // ISO timestamp
  txHash?: string;
}

export interface RebalanceEvent {
  timestamp: string;
  type: "user_strategy" | "auto_rebalance" | "emergency";
  fromPositions: DeployedPosition[];
  toPositions: DeployedPosition[];
  reason: string;
  txHashes: string[];
  netApyChange: number;
}

export interface PortfolioEntry {
  wallet: string;
  vaultAddress?: string;
  totalInvested: number;
  positions: DeployedPosition[];
  rebalanceHistory: RebalanceEvent[];
  x402Payments: X402Payment[];
  snapshots: PortfolioSnapshot[];
  lastDecision?: LastDecision;
  lastUpdated: string;
  createdAt: string;
}

export interface AdminPortfolioSummary {
  wallet: string;
  vaultAddress?: string;
  totalInvested: number;
  weightedApy: number;
  positionCount: number;
  lastUpdated: string;
  lastRebalance: string | null;
  rebalanceCount: number;
}

export interface AdminRebalanceEvent {
  wallet: string;
  vaultAddress?: string;
  timestamp: string;
  type: "user_strategy" | "auto_rebalance" | "emergency";
  reason: string;
  netApyChange: number;
  txHashes: string[];
}

function toPortfolioEntry(doc: any): PortfolioEntry {
  return {
    wallet: doc.wallet,
    vaultAddress: doc.vaultAddress,
    totalInvested: doc.totalInvested ?? 0,
    positions: (doc.positions ?? []).map((p: any) => ({
      protocol: p.protocol,
      protocolKey: p.protocolKey,
      amountUsdc: p.amountUsdc,
      allocationPct: p.allocationPct,
      entryApy: p.entryApy,
      deployedAt: p.deployedAt,
      txHash: p.txHash,
    })),
    rebalanceHistory: (doc.rebalanceHistory ?? []).map((e: any) => ({
      timestamp: e.timestamp,
      type: e.type,
      fromPositions: e.fromPositions ?? [],
      toPositions: e.toPositions ?? [],
      reason: e.reason,
      txHashes: e.txHashes ?? [],
      netApyChange: e.netApyChange ?? 0,
    })),
    x402Payments: (doc.x402Payments ?? []).map((p: any) => ({
      timestamp: p.timestamp,
      purpose: p.purpose,
      amountStroops: p.amountStroops,
      txHash: p.txHash,
      status: p.status,
    })),
    snapshots: (doc.snapshots ?? []).map((s: any) => ({
      timestamp: s.timestamp,
      vaultBalanceUsdc: s.vaultBalanceUsdc,
      totalDeployedUsdc: s.totalDeployedUsdc,
      weightedApy: s.weightedApy,
      totalValueEstimate: s.totalValueEstimate,
      source: s.source,
    })),
    lastDecision: doc.lastDecision ? {
      timestamp: doc.lastDecision.timestamp,
      action: doc.lastDecision.action,
      reason: doc.lastDecision.reason,
      currentApy: doc.lastDecision.currentApy,
      targetApy: doc.lastDecision.targetApy,
      improvement: doc.lastDecision.improvement,
    } : undefined,
    lastUpdated: doc.lastUpdated instanceof Date
      ? doc.lastUpdated.toISOString()
      : String(doc.lastUpdated),
    createdAt: doc.createdAt instanceof Date
      ? doc.createdAt.toISOString()
      : String(doc.createdAt),
  };
}

export const portfolioService = {
  async getPortfolio(wallet: string): Promise<PortfolioEntry | null> {
    try {
      const doc = await PortfolioModel.findOne({ wallet }).lean();
      if (!doc) return null;
      return toPortfolioEntry(doc);
    } catch (err) {
      logger.warn("getPortfolio failed", { wallet, err });
      return null;
    }
  },

  /** Look up a portfolio by its vault address (fallback for legacy agent-key-indexed entries). */
  async getPortfolioByVault(vaultAddress: string): Promise<PortfolioEntry | null> {
    try {
      const doc = await PortfolioModel.findOne({ vaultAddress }).lean();
      if (!doc) return null;
      return toPortfolioEntry(doc);
    } catch (err) {
      logger.warn("getPortfolioByVault failed", { vaultAddress, err });
      return null;
    }
  },

  /**
   * Record positions after user executes a strategy or agent rebalances.
   * Pushes a new RebalanceEvent into history and overwrites current positions.
   */
  async recordPositions(params: {
    wallet: string;
    vaultAddress?: string;
    positions: DeployedPosition[];
    totalAmount: number;
    txHashes: string[];
    reason?: string;
  }): Promise<PortfolioEntry> {
    const existing = await PortfolioModel.findOne({ wallet: params.wallet }).lean();
    const prevPositions: DeployedPosition[] = (existing?.positions ?? []) as DeployedPosition[];

    const prevApy = prevPositions.length > 0
      ? prevPositions.reduce((sum, p) => sum + (p.entryApy * p.allocationPct / 100), 0)
      : 0;
    const newApy = params.positions.reduce((sum, p) => sum + (p.entryApy * p.allocationPct / 100), 0);

    const eventType: "user_strategy" | "auto_rebalance" | "emergency" =
      params.reason?.startsWith("EMERGENCY") ? "emergency"
      : params.reason === "auto_rebalance" ? "auto_rebalance"
      : "user_strategy";

    const event: IRebalanceEvent = {
      timestamp: new Date().toISOString(),
      type: eventType,
      fromPositions: prevPositions as IDeployedPosition[],
      toPositions: params.positions as IDeployedPosition[],
      reason: params.reason || "User executed strategy",
      txHashes: params.txHashes,
      netApyChange: parseFloat((newApy - prevApy).toFixed(2)),
    };

    const now = new Date();
    const doc = await PortfolioModel.findOneAndUpdate(
      { wallet: params.wallet },
      {
        $set: {
          vaultAddress: params.vaultAddress || existing?.vaultAddress,
          totalInvested: params.totalAmount,
          positions: params.positions as IDeployedPosition[],
          lastUpdated: now,
        },
        $push: {
          rebalanceHistory: {
            $each: [event],
            $slice: -20,  // keep last 20 events
          },
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true, new: true, lean: true }
    );

    return toPortfolioEntry(doc!);
  },

  /**
   * Calculate PnL since the oldest tracked position was deployed.
   * Uses APY × days to estimate earned yield.
   */
  calculatePnl(entry: PortfolioEntry): {
    earnedUsdc: number;
    earnedPct: number;
    daysDeployed: number;
  } {
    if (entry.positions.length === 0 || entry.totalInvested === 0) {
      return { earnedUsdc: 0, earnedPct: 0, daysDeployed: 0 };
    }

    const oldestTs = entry.positions.reduce(
      (oldest, p) => (p.deployedAt < oldest ? p.deployedAt : oldest),
      entry.positions[0].deployedAt
    );
    const daysDeployed = (Date.now() - new Date(oldestTs).getTime()) / (1000 * 60 * 60 * 24);

    const earnedUsdc = entry.positions.reduce((sum, pos) => {
      const days = (Date.now() - new Date(pos.deployedAt).getTime()) / (1000 * 60 * 60 * 24);
      return sum + (pos.amountUsdc * (pos.entryApy / 100) * days / 365);
    }, 0);

    return {
      earnedUsdc,
      earnedPct: (earnedUsdc / entry.totalInvested) * 100,
      daysDeployed,
    };
  },

  async getAllWallets(): Promise<string[]> {
    try {
      return await PortfolioModel.distinct("wallet");
    } catch (err) {
      logger.warn("getAllWallets failed", { err });
      return [];
    }
  },

  async listPortfolios(params: { limit: number; offset: number }): Promise<PortfolioEntry[]> {
    const limit = Math.min(Math.max(params.limit, 1), 200);
    const offset = Math.max(params.offset, 0);
    try {
      const docs = await PortfolioModel.find({})
        .sort({ lastUpdated: -1 })
        .skip(offset)
        .limit(limit)
        .lean();
      return docs.map(toPortfolioEntry);
    } catch (err) {
      logger.warn("listPortfolios failed", { err });
      return [];
    }
  },

  async listAdminSummaries(params: { limit: number; offset: number }): Promise<AdminPortfolioSummary[]> {
    const entries = await this.listPortfolios(params);
    return entries.map((p) => {
      const weightedApy = p.positions.reduce((s, pos) => s + (pos.entryApy * pos.allocationPct / 100), 0);
      const lastRebalance = p.rebalanceHistory.slice(-1)[0]?.timestamp ?? null;
      return {
        wallet: p.wallet,
        vaultAddress: p.vaultAddress,
        totalInvested: p.totalInvested ?? 0,
        weightedApy: parseFloat(weightedApy.toFixed(2)),
        positionCount: p.positions.length,
        lastUpdated: p.lastUpdated,
        lastRebalance,
        rebalanceCount: p.rebalanceHistory.length,
      };
    });
  },

  async listRecentRebalanceEvents(limitRaw: number): Promise<AdminRebalanceEvent[]> {
    const limit = Math.min(Math.max(limitRaw || 50, 1), 200);
    try {
      const rows = await PortfolioModel.aggregate([
        { $unwind: "$rebalanceHistory" },
        { $sort: { "rebalanceHistory.timestamp": -1 } },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            wallet: 1,
            vaultAddress: 1,
            event: "$rebalanceHistory",
          },
        },
      ]);

      return rows.map((r: any) => ({
        wallet: r.wallet,
        vaultAddress: r.vaultAddress,
        timestamp: r.event?.timestamp,
        type: r.event?.type,
        reason: r.event?.reason,
        netApyChange: r.event?.netApyChange ?? 0,
        txHashes: r.event?.txHashes ?? [],
      }));
    } catch (err) {
      logger.warn("listRecentRebalanceEvents failed", { err });
      return [];
    }
  },

  /**
   * Record an x402 payment against a wallet's portfolio.
   * Called by the rebalancer (has wallet context) after a yield_query or rebalance_check.
   */
  async recordPayment(wallet: string, payment: X402Payment): Promise<void> {
    const entry = {
      timestamp: payment.timestamp ?? new Date().toISOString(),
      purpose: payment.purpose,
      amountStroops: payment.amountStroops,
      txHash: payment.txHash,
      status: payment.status,
    };
    try {
      await PortfolioModel.findOneAndUpdate(
        { wallet },
        {
          $push: { x402Payments: { $each: [entry], $slice: -100 } },
          $set: { lastUpdated: new Date() },
        },
        { upsert: false },
      );
    } catch (err) {
      logger.warn("recordPayment failed", { wallet, err });
    }
  },

  /**
   * Record an x402 payment when only the vaultAddress is known (e.g. from /settle route).
   * Best-effort: silently skips if no portfolio exists for that vault.
   */
  async recordPaymentByVault(vaultAddress: string, payment: X402Payment): Promise<void> {
    const entry = {
      timestamp: payment.timestamp ?? new Date().toISOString(),
      purpose: payment.purpose,
      amountStroops: payment.amountStroops,
      txHash: payment.txHash,
      status: payment.status,
    };
    try {
      const result = await PortfolioModel.findOneAndUpdate(
        { vaultAddress },
        {
          $push: { x402Payments: { $each: [entry], $slice: -100 } },
          $set: { lastUpdated: new Date() },
        },
        { upsert: false },
      );
      if (!result) {
        // No portfolio doc exists for this vault yet — payment won't be stored.
        // A portfolio is created on first POST /api/portfolio/record (upsert: true).
        // Payments made before that point (e.g. direct /settle calls) are silently dropped.
        logger.debug("recordPaymentByVault: no portfolio found for vault, skipping", { vaultAddress });
      }
    } catch (err) {
      logger.warn("recordPaymentByVault failed", { vaultAddress, err });
    }
  },

  /**
   * Push a portfolio snapshot (for charts + trend data).
   * Bounded to last 500 entries (~10 days at 30-min intervals).
   */
  async recordSnapshot(wallet: string, snapshot: PortfolioSnapshot): Promise<void> {
    const entry = {
      timestamp: snapshot.timestamp ?? new Date().toISOString(),
      vaultBalanceUsdc: snapshot.vaultBalanceUsdc,
      totalDeployedUsdc: snapshot.totalDeployedUsdc,
      weightedApy: snapshot.weightedApy,
      totalValueEstimate: snapshot.totalValueEstimate,
      source: snapshot.source,
    };
    try {
      await PortfolioModel.findOneAndUpdate(
        { wallet },
        {
          $push: { snapshots: { $each: [entry], $slice: -500 } },
          $set: { lastUpdated: new Date() },
        },
        { upsert: false },
      );
    } catch (err) {
      logger.warn("recordSnapshot failed", { wallet, err });
    }
  },

  /**
   * Persist the last rebalancer decision (why it acted or skipped).
   * Gives the portfolio page a "last decision" panel without bloating rebalanceHistory.
   */
  async setLastDecision(wallet: string, decision: LastDecision): Promise<void> {
    try {
      await PortfolioModel.findOneAndUpdate(
        { wallet },
        {
          $set: {
            lastDecision: {
              timestamp: decision.timestamp ?? new Date().toISOString(),
              action: decision.action,
              reason: decision.reason,
              currentApy: decision.currentApy,
              targetApy: decision.targetApy,
              improvement: decision.improvement,
            },
            lastUpdated: new Date(),
          },
        },
        { upsert: false },
      );
    } catch (err) {
      logger.warn("setLastDecision failed", { wallet, err });
    }
  },

  /**
   * Map protocol name from strategy to a stable protocolKey.
   */
  resolveProtocolKey(protocol: string): string {
    const p = protocol.toLowerCase();
    if (p.includes("blend")) return "blend";
    if (p.includes("soroswap")) return "soroswap";
    if (p.includes("ondo") || p.includes("usdy")) return "ondo";
    if (p.includes("defindex") || p.includes("vault")) return "defindex";
    if (p.includes("aquarius")) return "aquarius";
    if (p.includes("centrifuge")) return "centrifuge";
    return "other";
  },
};
