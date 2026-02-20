/**
 * Portfolio Tracking Service
 *
 * Tracks where user funds are deployed across DeFi protocols.
 * Updated when users execute strategies or when the agent rebalances autonomously.
 *
 * Positions are tracked internally (not read directly from Blend contracts)
 * because on-chain position reads require the exact vault/agent address + complex
 * Soroban simulation. APYs are updated in real-time from Blend/Soroswap SDKs.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { logger } from "../logger.js";

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
  type: "user_strategy" | "auto_rebalance";
  fromPositions: DeployedPosition[];
  toPositions: DeployedPosition[];
  reason: string;
  txHashes: string[];
  netApyChange: number;
}

export interface PortfolioEntry {
  wallet: string;
  vaultAddress?: string;
  totalInvested: number;  // last strategy total amount in USDC
  positions: DeployedPosition[];
  rebalanceHistory: RebalanceEvent[];
  lastUpdated: string;
  createdAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const PORTFOLIO_FILE = path.join(DATA_DIR, "portfolio.json");

const store = new Map<string, PortfolioEntry>();

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadFromDisk() {
  try {
    ensureDataDir();
    if (!existsSync(PORTFOLIO_FILE)) return;
    const data = JSON.parse(readFileSync(PORTFOLIO_FILE, "utf-8")) as Record<string, PortfolioEntry>;
    for (const [wallet, entry] of Object.entries(data)) store.set(wallet, entry);
    logger.debug(`Portfolio: loaded ${store.size} wallets from disk`);
  } catch (err) {
    logger.warn("Could not load portfolio from disk", { err });
  }
}

function saveToDisk() {
  try {
    ensureDataDir();
    const data: Record<string, PortfolioEntry> = {};
    for (const [wallet, entry] of store.entries()) data[wallet] = entry;
    writeFileSync(PORTFOLIO_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    logger.warn("Could not save portfolio to disk", { err });
  }
}

loadFromDisk();

export const portfolioService = {
  getPortfolio(wallet: string): PortfolioEntry | null {
    return store.get(wallet) || null;
  },

  /**
   * Record positions after user executes a strategy or agent rebalances.
   * Pushes a new RebalanceEvent into history and overwrites current positions.
   */
  recordPositions(params: {
    wallet: string;
    vaultAddress?: string;
    positions: DeployedPosition[];
    totalAmount: number;
    txHashes: string[];
    reason?: string;
  }): PortfolioEntry {
    const existing = store.get(params.wallet);
    const prevPositions = existing?.positions || [];

    const prevApy = prevPositions.length > 0
      ? prevPositions.reduce((sum, p) => sum + (p.entryApy * p.allocationPct / 100), 0)
      : 0;
    const newApy = params.positions.reduce((sum, p) => sum + (p.entryApy * p.allocationPct / 100), 0);

    const event: RebalanceEvent = {
      timestamp: new Date().toISOString(),
      type: params.reason === "auto_rebalance" ? "auto_rebalance" : "user_strategy",
      fromPositions: prevPositions,
      toPositions: params.positions,
      reason: params.reason || "User executed strategy",
      txHashes: params.txHashes,
      netApyChange: parseFloat((newApy - prevApy).toFixed(2)),
    };

    const entry: PortfolioEntry = {
      wallet: params.wallet,
      vaultAddress: params.vaultAddress || existing?.vaultAddress,
      totalInvested: params.totalAmount,
      positions: params.positions,
      rebalanceHistory: [...(existing?.rebalanceHistory || []).slice(-19), event],
      lastUpdated: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    store.set(params.wallet, entry);
    saveToDisk();
    return entry;
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

  getAllWallets(): string[] {
    return Array.from(store.keys());
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
