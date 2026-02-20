"use client";
import { useState, useEffect, useCallback } from "react";
import { fetchAPI } from "@/lib/api";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export interface CreditInfo {
  wallet: string;
  balance: number;
  plan: "free" | "basic" | "pro";
  monthlyQuota: number;
  usedThisMonth: number;
  resetDate: string;
  history: Array<{
    action: string;
    amount: number;
    timestamp: string;
    note?: string;
  }>;
}

export interface CreditPlan {
  id: string;
  name: string;
  credits: number;
  priceUSDC: number;
  priceXLM: number;
  description: string;
  features: string[];
}

export function useCredits(wallet: string | null) {
  const [credits, setCredits] = useState<CreditInfo | null>(null);
  const [plans, setPlans] = useState<CreditPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAPI<CreditInfo>(`/api/credits/${wallet}`);
      setCredits(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  const fetchPlans = useCallback(async () => {
    try {
      const data = await fetchAPI<{ plans: CreditPlan[] }>("/api/credits/plans/list");
      setPlans(data.plans);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchCredits();
    fetchPlans();
  }, [fetchCredits, fetchPlans]);

  const purchasePlan = async (plan: string, txHash: string, paymentToken: "USDC" | "XLM") => {
    if (!wallet) throw new Error("No wallet connected");
    const res = await fetch(`${BACKEND_URL}/api/credits/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet, plan, txHash, paymentToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Purchase failed");
    await fetchCredits();
    return data;
  };

  return { credits, plans, loading, error, refresh: fetchCredits, purchasePlan };
}
