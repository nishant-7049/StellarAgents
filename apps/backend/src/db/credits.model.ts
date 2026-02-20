import mongoose, { Schema, Document } from "mongoose";
import type { CreditAction, CreditPlan } from "../services/credits.service.js";

export interface ICreditsDoc extends Document {
  wallet: string;
  balance: number;
  plan: CreditPlan;
  monthlyQuota: number;
  usedThisMonth: number;
  resetDate: string;
  expiresAt?: string;
  history: Array<{
    action: CreditAction;
    amount: number;
    timestamp: string;
    note?: string;
  }>;
  createdAt: string;
}

const HistoryEntrySchema = new Schema(
  {
    action:    { type: String, required: true },
    amount:    { type: Number, required: true },
    timestamp: { type: String, required: true },
    note:      { type: String },
  },
  { _id: false }
);

const CreditsSchema = new Schema<ICreditsDoc>(
  {
    wallet:        { type: String, required: true, unique: true, index: true },
    balance:       { type: Number, required: true, default: 0 },
    plan:          { type: String, enum: ["free", "basic", "pro"], default: "free" },
    monthlyQuota:  { type: Number, required: true, default: 100 },
    usedThisMonth: { type: Number, required: true, default: 0 },
    resetDate:     { type: String, required: true },
    expiresAt:     { type: String },
    history:       { type: [HistoryEntrySchema], default: [] },
    createdAt:     { type: String, required: true },
  },
  { versionKey: false }
);

export const CreditsModel = mongoose.model<ICreditsDoc>("Credits", CreditsSchema);
