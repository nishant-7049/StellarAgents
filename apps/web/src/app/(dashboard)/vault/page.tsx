"use client";
import { CreateVaultCard } from "@/components/vault/CreateVaultCard";
import { VaultBalance } from "@/components/vault/VaultBalance";
import { DepositForm } from "@/components/vault/DepositForm";
import { WithdrawForm } from "@/components/vault/WithdrawForm";
import { AgentList } from "@/components/vault/AgentList";
import { useVault } from "@/hooks/useVault";

export default function VaultPage() {
  const { vaultAddress } = useVault();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vault Manager</h1>
        <p className="text-[var(--text-secondary)]">Create and manage your USDC vault</p>
      </div>
      {!vaultAddress ? (
        <CreateVaultCard />
      ) : (
        <>
          <VaultBalance />
          <div className="grid gap-4 md:grid-cols-2">
            <DepositForm />
            <WithdrawForm />
          </div>
          <AgentList />
        </>
      )}
    </div>
  );
}
