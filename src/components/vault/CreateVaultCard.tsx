"use client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useVault } from "@/hooks/useVault";
import { useWallet } from "@/hooks/useWallet";

export function CreateVaultCard() {
  const { address, isConnected, connect } = useWallet();
  const { createVault, loading } = useVault();

  if (!isConnected) {
    return (
      <Card glow className="text-center py-12">
        <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-4">Connect Freighter to create a vault</p>
        <Button onClick={connect}>Connect Wallet</Button>
      </Card>
    );
  }

  return (
    <Card glow className="text-center py-12">
      <h3 className="text-lg font-semibold mb-2">Create Your Vault</h3>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        Deploy a smart vault contract to hold USDC and authorize agents
      </p>
      <Button onClick={createVault} disabled={loading}>
        {loading ? "Creating..." : "Create Vault"}
      </Button>
    </Card>
  );
}
