"use client";
import { ChatMessage } from "@/hooks/useAgentChat";
import { Badge } from "@/components/ui/Badge";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
        isUser ? "bg-indigo-600 text-white" :
        isSystem ? "bg-yellow-500/10 border border-yellow-500/30 text-yellow-200" :
        "bg-[var(--bg-card)] border border-[var(--border)]"
      }`}>
        {isSystem && <Badge variant="warning" >x402</Badge>}
        <p className="text-sm mt-1">{message.content}</p>
        {message.x402 && (
          <div className="mt-2 text-xs opacity-70 font-mono">
            tx: {message.x402.txHash?.slice(0, 16)}...
          </div>
        )}
      </div>
    </div>
  );
}
