"use client";
import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage } from "@/hooks/useAgentChat";
import { MessageBubble } from "./MessageBubble";
import { StrategyDisplay } from "./StrategyDisplay";
import { ExecuteStrategy } from "./ExecuteStrategy";
import { X402PaymentBanner } from "./X402PaymentBanner";
import { Card } from "@/components/ui/Card";
import { Sparkles, TrendingUp, Shield, Zap } from "lucide-react";

interface ChatWindowProps {
  messages: ChatMessage[];
  userAddress?: string | null;
}

const exampleQueries = [
  { icon: Shield, text: "Low-risk yield strategy for $5000", risk: "low" },
  { icon: TrendingUp, text: "Best APY for moderate risk", risk: "moderate" },
  { icon: Zap, text: "Aggressive yield farming strategy", risk: "high" },
  { icon: Sparkles, text: "Diversified DeFi portfolio", risk: "moderate" },
];

export function ChatWindow({ messages, userAddress }: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <div ref={scrollRef} className="flex flex-col gap-4 min-h-[400px] max-h-[600px] overflow-y-auto p-4">
      {messages.length === 0 && (
        <div className="text-center py-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-6 h-6 text-indigo-400" />
            <h3 className="text-xl font-bold">AI Yield Optimizer</h3>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            Get personalized DeFi yield strategies powered by real-time market data
          </p>

          <div className="max-w-md mx-auto space-y-2">
            <p className="text-xs text-[var(--text-secondary)] mb-3">Try these examples:</p>
            {exampleQueries.map((query, i) => (
              <Card
                key={i}
                className="p-3 hover:border-indigo-400/50 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <query.icon className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <span className="text-sm">{query.text}</span>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-6 text-xs text-[var(--text-secondary)]">
            💡 Queries cost 0.01 USDC via x402 • Powered by Claude AI + Live DeFi Data
          </div>
        </div>
      )}
      <AnimatePresence>
        {messages.map((msg: any) => {
          // Calculate total APY for strategy display
          const totalApy = msg.strategies?.reduce((sum: number, s: any) => sum + s.estimated_apy, 0) || 0;

          // Get total amount from message data or default to $1000
          const totalAmount = msg.amount_usdc ||
                              msg.strategies?.reduce((sum: number, s: any) => sum + (s.amount || 0), 0) ||
                              1000;

          return (
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
                <>
                  <StrategyDisplay
                    strategies={msg.strategies}
                    totalApy={totalApy}
                    summary={msg.content}
                  />
                  {userAddress && (
                    <ExecuteStrategy
                      strategies={msg.strategies}
                      totalAmount={totalAmount}
                      userAddress={userAddress}
                    />
                  )}
                </>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
