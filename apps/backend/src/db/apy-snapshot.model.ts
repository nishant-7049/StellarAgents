import mongoose, { Schema, Document } from "mongoose";

export interface IApySnapshot extends Document {
  protocol: string;       // "blend" | "soroswap"
  poolId: string;
  apy: number;            // supply APY % for primary reserve
  tvlUsdc: number;        // total USDC value locked (pool-level, not per-user)
  reserves: Array<{ symbol: string; totalSupplyUsdc: number; supplyApy: number }>;
  timestamp: Date;
}

const ApySnapshotSchema = new Schema<IApySnapshot>({
  protocol: { type: String, required: true, index: true },
  poolId:   { type: String, required: true },
  apy:      { type: Number, required: true },
  tvlUsdc:  { type: Number, required: true },
  reserves: [{
    symbol: String,
    totalSupplyUsdc: Number,
    supplyApy: Number,
  }],
  timestamp: { type: Date, default: Date.now, index: true },
}, { collection: "apysnapshots" });

// TTL index: auto-delete snapshots older than 7 days
ApySnapshotSchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 });

export const ApySnapshot = mongoose.model<IApySnapshot>("ApySnapshot", ApySnapshotSchema);
