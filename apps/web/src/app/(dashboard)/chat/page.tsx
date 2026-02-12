"use client";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { QueryInput } from "@/components/chat/QueryInput";
import { X402FlowAnimation } from "@/components/chat/X402FlowAnimation";
import { useAgentChat } from "@/hooks/useAgentChat";
import { Card } from "@/components/ui/Card";

export default function ChatPage() {
  const { messages, loading, chatPhase, lastPayment, sendQuery } = useAgentChat();

  const showX402Flow = chatPhase === "building_payment" || chatPhase === "settling" || (chatPhase === "confirmed" && !!lastPayment);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agent Chat</h1>
        <p className="text-[var(--text-secondary)]">Query the AI yield optimizer — powered by x402 payments</p>
      </div>
      <Card className="flex flex-col">
        <ChatWindow messages={messages} />
        {showX402Flow && (
          <div className="px-4">
            <X402FlowAnimation
              phase={chatPhase}
              txHash={lastPayment?.txHash}
              amount={lastPayment?.amount}
            />
          </div>
        )}
        <div className="border-t border-[var(--border)] p-4">
          <QueryInput onSubmit={sendQuery} loading={loading} />
        </div>
      </Card>
    </div>
  );
}
