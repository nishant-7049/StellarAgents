"use client";
import { ChatMessage } from "@/hooks/useAgentChat";
import { MessageBubble } from "./MessageBubble";
import { StrategyCard } from "./StrategyCard";
import { X402PaymentBanner } from "./X402PaymentBanner";

interface ChatWindowProps {
  messages: ChatMessage[];
}

export function ChatWindow({ messages }: ChatWindowProps) {
  return (
    <div className="flex flex-col gap-4 min-h-[400px] max-h-[600px] overflow-y-auto p-4">
      {messages.length === 0 && (
        <div className="text-center text-[var(--text-secondary)] py-20">
          <p className="text-lg mb-2">Ask the Yield Optimizer</p>
          <p className="text-sm">Try: &quot;What&apos;s the best yield strategy for 1000 USDC?&quot;</p>
        </div>
      )}
      {messages.map(msg => (
        <div key={msg.id} className="space-y-3">
          <MessageBubble message={msg} />
          {msg.x402 && <X402PaymentBanner txHash={msg.x402.txHash} amount={msg.x402.amount} />}
          {msg.strategies && msg.strategies.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {msg.strategies.map((s: any, i: number) => <StrategyCard key={i} strategy={s} />)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
