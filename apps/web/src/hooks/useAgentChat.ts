"use client";
import { useState } from "react";
import { fetchYieldQuery } from "@/lib/api";
import { useX402, type X402Phase } from "./useX402";
import { DEMO_VAULT_ADDRESS, FACILITATOR_PUBLIC_KEY } from "@/lib/contracts";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  strategies?: any[];
  x402?: { txHash: string; amount: string };
  timestamp: number;
}

export type ChatPhase = "idle" | "querying" | "payment_required" | "building_payment" | "settling" | "confirmed" | "error";

export function useAgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [chatPhase, setChatPhase] = useState<ChatPhase>("idle");
  const x402 = useX402();

  async function sendQuery(query: string, risk: string) {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: query,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setChatPhase("querying");
    x402.reset();

    try {
      // 1. Initial query — expect 402
      const { status, data } = await fetchYieldQuery(query, risk);

      if (status === 402) {
        const amount = data.accepts?.[0]?.amount || "100000";
        const payTo = data.accepts?.[0]?.payTo || FACILITATOR_PUBLIC_KEY;

        setChatPhase("payment_required");
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "system",
          content: `Payment required: ${(parseInt(amount) / 10_000_000).toFixed(2)} USDC via x402`,
          x402: { txHash: "", amount },
          timestamp: Date.now(),
        }]);

        // 2. Build real x402 payment header
        setChatPhase("building_payment");
        const header = await x402.buildPaymentHeader({
          vaultContract: DEMO_VAULT_ADDRESS,
          payTo,
          amount,
          memo: "yield_q",
        });

        if (!header) {
          setChatPhase("error");
          setMessages(prev => [...prev, {
            id: (Date.now() + 2).toString(),
            role: "system",
            content: "Failed to build payment header. Is the backend running?",
            timestamp: Date.now(),
          }]);
          setLoading(false);
          return;
        }

        // 3. Retry with real payment
        setChatPhase("settling");
        x402.setSettling();
        const retryResult = await fetchYieldQuery(query, risk, header);

        if (retryResult.status === 200) {
          const txHash = retryResult.data.x402?.txHash || "";
          setChatPhase("confirmed");
          x402.setConfirmed(txHash, amount);

          setMessages(prev => [...prev, {
            id: (Date.now() + 3).toString(),
            role: "assistant",
            content: retryResult.data.summary || "Strategy generated",
            strategies: retryResult.data.strategies,
            x402: { txHash, amount },
            timestamp: Date.now(),
          }]);
        } else {
          setChatPhase("error");
          x402.setFailed("Payment settlement failed");
          setMessages(prev => [...prev, {
            id: (Date.now() + 3).toString(),
            role: "system",
            content: `Payment failed: ${retryResult.data.error || "Unknown error"}`,
            timestamp: Date.now(),
          }]);
        }
      } else {
        // Direct 200 (already paid or x402 disabled)
        setChatPhase("confirmed");
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.summary || "Strategy generated",
          strategies: data.strategies,
          x402: data.x402,
          timestamp: Date.now(),
        }]);
      }
    } catch (err) {
      setChatPhase("error");
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "system",
        content: "Error: Could not reach the yield optimizer. Make sure the backend is running.",
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  return { messages, loading, chatPhase, x402Phase: x402.phase, lastPayment: x402.lastPayment, sendQuery };
}
