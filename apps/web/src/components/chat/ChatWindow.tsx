"use client";
import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage } from "@/hooks/useAgentChat";
import { MessageBubble } from "./MessageBubble";
import { StrategyCard } from "./StrategyCard";
import { X402PaymentBanner } from "./X402PaymentBanner";

interface ChatWindowProps {
  messages: ChatMessage[];
}

export function ChatWindow({ messages }: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <div ref={scrollRef} className="flex flex-col gap-4 min-h-[400px] max-h-[600px] overflow-y-auto p-4">
      {messages.length === 0 && (
        <div className="text-center text-[var(--text-secondary)] py-20">
          <p className="text-lg mb-2">Ask the Yield Optimizer</p>
          <p className="text-sm">Try: &quot;What&apos;s the best yield strategy for 1000 USDC?&quot;</p>
        </div>
      )}
      <AnimatePresence>
        {messages.map((msg, idx) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="space-y-3"
          >
            <MessageBubble message={msg} />
            {msg.x402 && msg.x402.txHash && (
              <X402PaymentBanner txHash={msg.x402.txHash} amount={msg.x402.amount} />
            )}
            {msg.strategies && msg.strategies.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2">
                {msg.strategies.map((s: any, i: number) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 + 0.2 }}
                  >
                    <StrategyCard strategy={s} />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
