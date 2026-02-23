"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useRegistry } from "@/hooks/useRegistry";
import { useWallet } from "@/hooks/useWallet";
import { DEMO_VAULT_ADDRESS, AGENT_SIGNER_PUBLIC_KEY } from "@/lib/contracts";
import { toStroops } from "@/lib/stellar";
import { TxStateIndicator } from "@/components/ui/TxStateIndicator";

export function RegisterForm() {
  const { isConnected, connect } = useWallet();
  const { registerAgent, txState, lastTxHash } = useRegistry();
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
    const amount = toStroops(parseFloat(pricing || "0.01")).toString();
    await registerAgent({
      name,
      capabilities: caps,
      pricing: amount,
      vaultAddress: DEMO_VAULT_ADDRESS,
      agentSigner: AGENT_SIGNER_PUBLIC_KEY,
    });
    setName(""); setCapabilities(""); setPricing("0.01");
  };

  return (
    <Card glow>
      <h3 className="text-lg font-semibold mb-4">Register New Agent</h3>
      <div className="space-y-4">
        <Input label="Agent Name" placeholder="Yield Optimizer" value={name} onChange={e => setName(e.target.value)} />
        <Input label="Capabilities (comma-separated)" placeholder="yield, rebalance" value={capabilities} onChange={e => setCapabilities(e.target.value)} />
        <Input label="Price per Query (USDC)" type="number" placeholder="0.01" value={pricing} onChange={e => setPricing(e.target.value)} />
        <Button
          onClick={handleSubmit}
          disabled={!name || (txState !== "idle" && txState !== "error")}
          className="w-full"
        >
          {txState !== "idle" && txState !== "error" ? "Registering..." : "Register Agent"}
        </Button>
        <TxStateIndicator state={txState} txHash={lastTxHash} />
      </div>
    </Card>
  );
}
