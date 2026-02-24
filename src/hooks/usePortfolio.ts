"use client";
import { useState, useEffect, useCallback } from "react";
import { fetchAPI } from "@/lib/api";

export interface DeployedPosition {
  protocol: string;
  protocolKey: string;
  amountUsdc: number;
  allocationPct: number;
  entryApy: number;
  currentApy: number;
  currentValue: number;
  deployedAt: string;
  txHash?: string;
}

export interface RebalanceHistoryItem {
  timestamp: string;
  type: "user_strategy" | "auto_rebalance";
  reason: string;
  netApyChange: number;
  txCount: number;
}

export interface PortfolioData {
  wallet: string;
  vaultAddress: string | null;
  vaultBalance: string;
  vaultBalanceRaw: string;
  deployedPositions: DeployedPosition[];
  totalDeployed: string;
  idleInVault: string;
  weightedApy: string;
  projectedYearlyReturn: string;
  projectedMonthlyReturn: string;
  projectedDailyReturn: string;
  pnl: {
    earnedUsdc: string;
    earnedPct: string;
    daysDeployed: number;
  };
  totalValue: string;
  currentRates: Record<string, number>;
  lastRebalance: string | null;
  rebalanceCount: number;
  rebalanceHistory: RebalanceHistoryItem[];
}

export function usePortfolio(wallet: string | null) {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAPI<PortfolioData>(`/api/portfolio/${wallet}`);
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function recordPositions(params: {
    positions: DeployedPosition[];
    totalAmount: number;
    txHashes: string[];
  }) {
    if (!wallet) return;
    await fetchAPI("/api/portfolio/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet, vaultAddress: data?.vaultAddress, ...params }),
    });
    await refresh();
  }

  async function agentRebalance(targetStrategy?: any[]) {
    if (!wallet) throw new Error("Wallet not connected");
    const result = await fetchAPI<any>("/api/portfolio/agent-rebalance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet, vaultAddress: data?.vaultAddress, targetStrategy }),
    });
    await refresh();
    return result;
  }

  return { data, loading, error, refresh, recordPositions, agentRebalance };
}
