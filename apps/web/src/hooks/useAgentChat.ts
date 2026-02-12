"use client";
import { useState } from "react";
import { fetchYieldQuery } from "@/lib/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  strategies?: any[];
  x402?: { txHash: string; amount: string };
  timestamp: number;
}

export function useAgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  async function sendQuery(query: string, risk: string) {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: query,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const { status, data } = await fetchYieldQuery(query, risk);

      if (status === 402) {
        const sysMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "system",
          content: `Payment required: ${(parseInt(data.accepts?.[0]?.amount || "100000") / 10_000_000).toFixed(2)} USDC`,
          x402: { txHash: "demo_tx_" + Date.now(), amount: data.accepts?.[0]?.amount || "100000" },
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, sysMsg]);

        // Auto-retry with mock payment for demo
        const retryData = await fetchYieldQuery(query, risk);
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 2).toString(),
          role: "assistant",
          content: retryData.data.summary || "Strategy generated",
          strategies: retryData.data.strategies,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.summary || "Strategy generated",
          strategies: data.strategies,
          x402: data.x402,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (err) {
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

  return { messages, loading, sendQuery };
}
