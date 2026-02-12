"use client";
import { useState } from "react";
import { useWallet } from "./useWallet";

export function useVault() {
  const { address } = useWallet();
  const [vaultAddress, setVaultAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState("0");
  const [loading, setLoading] = useState(false);

  async function createVault() {
    if (!address) return;
    setLoading(true);
    try {
      // Would use Freighter to sign VaultFactory.create_vault() transaction
      setVaultAddress("DEMO_VAULT_" + address.slice(0, 8));
    } finally { setLoading(false); }
  }

  async function deposit(amount: string) {
    setLoading(true);
    try {
      // Would use Freighter to sign vault.deposit() transaction
      const current = parseFloat(balance);
      setBalance((current + parseFloat(amount)).toString());
    } finally { setLoading(false); }
  }

  async function withdraw(amount: string) {
    setLoading(true);
    try {
      // Would use Freighter to sign vault.withdraw() transaction
      const current = parseFloat(balance);
      setBalance(Math.max(0, current - parseFloat(amount)).toString());
    } finally { setLoading(false); }
  }

  return { vaultAddress, balance, loading, createVault, deposit, withdraw };
}
