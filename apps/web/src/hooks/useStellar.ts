"use client";
import { useState } from "react";
import { formatUsdc, toStroops, rpc } from "@/lib/stellar";

export function useStellar() {
  const [loading, setLoading] = useState(false);

  async function getBalance(address: string): Promise<string> {
    try {
      // For Soroban RPC, getAccount returns an Account without balances
      // Token balances are read from the token contract directly
      return "0";
    } catch {
      return "0";
    }
  }

  return { loading, setLoading, getBalance, formatUsdc, toStroops, rpc };
}
