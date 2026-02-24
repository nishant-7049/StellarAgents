"use client";
import { useState } from "react";
import { nativeToScVal } from "@stellar/stellar-sdk";
import { formatUsdc, toStroops, rpc, readContract } from "@/lib/stellar";
import { USDC_SAC_ADDRESS } from "@/lib/contracts";

export function useStellar() {
  const [loading, setLoading] = useState(false);

  async function getBalance(address: string): Promise<string> {
    if (!USDC_SAC_ADDRESS || !address) return "0";
    try {
      const balance = await readContract<bigint>(
        USDC_SAC_ADDRESS,
        "balance",
        [nativeToScVal(address, { type: "address" })],
      );
      return balance?.toString() || "0";
    } catch {
      return "0";
    }
  }

  return { loading, setLoading, getBalance, formatUsdc, toStroops, rpc };
}
