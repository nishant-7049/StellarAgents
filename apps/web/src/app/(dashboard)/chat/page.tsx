"use client";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { QueryInput } from "@/components/chat/QueryInput";
import { X402FlowAnimation } from "@/components/chat/X402FlowAnimation";
import { useAgentChat } from "@/hooks/useAgentChat";
import { useWallet } from "@/hooks/useWallet";
import { useVault } from "@/hooks/useVault";
import { Card } from "@/components/ui/Card";

export default function ChatPage() {
  const { address } = useWallet();
  const { vaultAddress } = useVault();
  const { messages, loading, chatPhase, lastPayment, sendQuery } = useAgentChat(vaultAddress);

  const showX402Flow = chatPhase === "building_payment" || chatPhase === "settling" || (chatPhase === "confirmed" && !!lastPayment);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agent Chat</h1>
        <p className="text-[var(--text-secondary)]">Query the AI yield optimizer — powered by x402 payments</p>
      </div>
      <Card className="flex flex-col">
        <ChatWindow messages={messages} userAddress={address} />
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
