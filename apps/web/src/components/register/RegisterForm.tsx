"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useRegistry } from "@/hooks/useRegistry";
import { useWallet } from "@/hooks/useWallet";

export function RegisterForm() {
  const { isConnected, connect } = useWallet();
  const { registerAgent } = useRegistry();
  const [name, setName] = useState("");
  const [capabilities, setCapabilities] = useState("");
  const [pricing, setPricing] = useState("0.01");

  if (!isConnected) {
    return (
      <Card glow className="text-center py-12">
        <h3 className="text-lg font-semibold mb-2">Connect Wallet to Register</h3>
        <Button onClick={connect}>Connect Wallet</Button>
      </Card>
    );
  }

  const handleSubmit = async () => {
    const caps = capabilities.split(",").map(c => c.trim()).filter(Boolean);
    await registerAgent({ name, capabilities: caps, pricing });
    setName(""); setCapabilities(""); setPricing("0.01");
  };

  return (
    <Card glow>
      <h3 className="text-lg font-semibold mb-4">Register New Agent</h3>
      <div className="space-y-4">
        <Input label="Agent Name" placeholder="Yield Optimizer" value={name} onChange={e => setName(e.target.value)} />
        <Input label="Capabilities (comma-separated)" placeholder="yield, rebalance" value={capabilities} onChange={e => setCapabilities(e.target.value)} />
        <Input label="Price per Query (USDC)" type="number" placeholder="0.01" value={pricing} onChange={e => setPricing(e.target.value)} />
        <Button onClick={handleSubmit} disabled={!name} className="w-full">Register Agent</Button>
      </div>
    </Card>
  );
}
