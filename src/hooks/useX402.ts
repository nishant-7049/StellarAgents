"use client";
import { useState } from "react";
import { buildX402Header } from "@/lib/api";

export type X402Phase = "idle" | "building" | "settling" | "confirmed" | "error";

export function useX402() {
  const [phase, setPhase] = useState<X402Phase>("idle");
  const [lastPayment, setLastPayment] = useState<{ txHash: string; amount: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buildPaymentHeader(params: {
    vaultContract: string;
    payTo: string;
    amount: string;
    memo?: string;
  }): Promise<string | null> {
    setPhase("building");
    setError(null);
    try {
      const header = await buildX402Header(params);
      return header;
    } catch (e: any) {
      setError(e.message);
      setPhase("error");
      return null;
    }
  }

  function setSettling() { setPhase("settling"); }

  function setConfirmed(txHash: string, amount: string) {
    setLastPayment({ txHash, amount });
    setPhase("confirmed");
  }

  function setFailed(msg: string) {
    setError(msg);
    setPhase("error");
  }

  function reset() {
    setPhase("idle");
    setLastPayment(null);
    setError(null);
  }

  return { phase, lastPayment, error, buildPaymentHeader, setSettling, setConfirmed, setFailed, reset };
}
