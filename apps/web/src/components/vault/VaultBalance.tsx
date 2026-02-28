"use client";
import { Card } from "@/components/ui/Card";
import { useVault } from "@/hooks/useVault";

export function VaultBalance() {
  const { balance, vaultAddress } = useVault();
  return (
    <Card glow>
      <div className="text-sm text-[var(--text-secondary)]">Vault Balance</div>
      <div className="text-4xl font-bold mt-1">{parseFloat(balance).toFixed(2)} <span className="text-lg text-[var(--text-secondary)]">USDC</span></div>
      {vaultAddress && <div className="mt-2 text-xs font-mono text-[var(--text-secondary)]">{vaultAddress}</div>}
    </Card>
  );
}
