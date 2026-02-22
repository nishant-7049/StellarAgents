import mongoose, { Schema, Document } from "mongoose";

export interface IDeployedPosition {
  protocol: string;
  protocolKey: string;
  amountUsdc: number;
  allocationPct: number;
  entryApy: number;
  deployedAt: string;
  txHash?: string;
}

export interface IRebalanceEvent {
  timestamp: string;
  type: "user_strategy" | "auto_rebalance" | "emergency";
  fromPositions: IDeployedPosition[];
  toPositions: IDeployedPosition[];
  reason: string;
  txHashes: string[];
  netApyChange: number;
}

export interface IX402Payment {
  timestamp: string;
  purpose: "yield_query" | "rebalance_check" | "execute" | "other";
  amountStroops: number;
  txHash?: string;
  status: "settled" | "unknown" | "failed";
}

export interface ISnapshot {
  timestamp: string;
  vaultBalanceUsdc: number;
  totalDeployedUsdc: number;
  weightedApy: number;
  totalValueEstimate: number;
  source: "onchain" | "tracked";
}

export interface ILastDecision {
  timestamp: string;
  action: "rebalanced" | "skipped" | "error";
  reason: string;
  currentApy: number;
  targetApy?: number;
  improvement?: number;
}

export interface IPortfolioEntry extends Document {
  wallet: string;
  vaultAddress?: string;
  totalInvested: number;
  positions: IDeployedPosition[];
  rebalanceHistory: IRebalanceEvent[];
  x402Payments: IX402Payment[];
  snapshots: ISnapshot[];
  lastDecision?: ILastDecision;
  lastUpdated: Date;
  createdAt: Date;
}

const DeployedPositionSchema = new Schema({
  protocol: String,
  protocolKey: String,
  amountUsdc: Number,
  allocationPct: Number,
  entryApy: Number,
  deployedAt: String,
  txHash: String,
}, { _id: false });

const RebalanceEventSchema = new Schema({
  timestamp: String,
  type: String,
  fromPositions: [DeployedPositionSchema],
  toPositions: [DeployedPositionSchema],
  reason: String,
  txHashes: [String],
  netApyChange: Number,
}, { _id: false });

const X402PaymentSchema = new Schema({
  timestamp: String,
  purpose: String,
  amountStroops: Number,
  txHash: String,
  status: String,
}, { _id: false });

const SnapshotSchema = new Schema({
  timestamp: String,
  vaultBalanceUsdc: Number,
  totalDeployedUsdc: Number,
  weightedApy: Number,
  totalValueEstimate: Number,
  source: String,
}, { _id: false });

const LastDecisionSchema = new Schema({
  timestamp: String,
  action: String,
  reason: String,
  currentApy: Number,
  targetApy: Number,
  improvement: Number,
}, { _id: false });

const PortfolioSchema = new Schema<IPortfolioEntry>({
  wallet:           { type: String, required: true, unique: true, index: true },
  vaultAddress:     { type: String, index: true },
  totalInvested:    Number,
  positions:        { type: [DeployedPositionSchema], default: [] },
  rebalanceHistory: { type: [RebalanceEventSchema],  default: [] },
  x402Payments:     { type: [X402PaymentSchema],     default: [] },
  snapshots:        { type: [SnapshotSchema],         default: [] },
  lastDecision:     { type: LastDecisionSchema },
  lastUpdated: { type: Date, default: Date.now },
  createdAt:   { type: Date, default: Date.now },
}, { collection: "portfolios", timestamps: false });

export const PortfolioModel = mongoose.model<IPortfolioEntry>("Portfolio", PortfolioSchema);
