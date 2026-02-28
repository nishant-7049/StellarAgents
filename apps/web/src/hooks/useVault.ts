"use client";
import { useState, useEffect, useCallback } from "react";
import { nativeToScVal } from "@stellar/stellar-sdk";
import { useWallet } from "./useWallet";
import { buildContractTx, signAndSubmit, readContract, toStroops, type TxState } from "@/lib/stellar";
import { VAULT_FACTORY_ADDRESS, USDC_SAC_ADDRESS } from "@/lib/contracts";

interface AgentInfo {
  address: string;
  dailyLimit: string;
  spent: string;
  isActive: boolean;
}

export function useVault() {
  const { address } = useWallet();
  const [vaultAddress, setVaultAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState("0");
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [txState, setTxState] = useState<TxState>("idle");
  const [lastTxHash, setLastTxHash] = useState<string | undefined>();
  const [txError, setTxError] = useState<string | null>(null);

  // Load vault on mount / address change
  useEffect(() => {
    if (!address) {
      setVaultAddress(null);
      setBalance("0");
      setAgents([]);
      return;
    }
    loadVault(address);
  }, [address]);

  async function loadVault(owner: string) {
    try {
      setLoading(true);
      // Use backend API to avoid READ_SOURCE account issues in browser
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const resp = await fetch(`${BACKEND_URL}/api/vaults/${owner}`);
      if (!resp.ok) throw new Error("Failed to fetch vault");
      const data = await resp.json();
      const vault: string | null = data.vault ?? null;
      if (!vault) {
        setVaultAddress(null);
        return;
      }
      setVaultAddress(vault);
      setBalance(data.balance ?? "0");
      await loadVaultData(vault);
    } catch {
      setVaultAddress(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadVaultData(vault: string) {
    try {
      const [bal, agentAddrs] = await Promise.all([
        readContract<bigint>(vault, "balance", []),
        readContract<string[]>(vault, "list_agents", []).catch(() => [] as string[]),
      ]);
      setBalance(bal.toString());

      // Load policies for each agent
      const agentInfos: AgentInfo[] = [];
      for (const addr of agentAddrs) {
        try {
          const policy = await readContract<any>(vault, "get_agent_policy", [
            nativeToScVal(addr, { type: "address" }),
          ]);
          agentInfos.push({
            address: addr,
            dailyLimit: (policy.daily_limit ?? policy.dailyLimit ?? 0).toString(),
            spent: (policy.spent_today ?? policy.spentToday ?? 0).toString(),
            isActive: policy.is_active ?? policy.isActive ?? true,
          });
        } catch {
          agentInfos.push({ address: addr, dailyLimit: "0", spent: "0", isActive: true });
        }
      }
      setAgents(agentInfos);
    } catch {
      // Vault exists but can't read data
    }
  }

  const createVault = useCallback(async () => {
    if (!address) return;
    setTxState("building");
    setLastTxHash(undefined);
    try {
      const xdr = await buildContractTx({
        contractId: VAULT_FACTORY_ADDRESS,
        method: "create_vault",
        args: [nativeToScVal(address, { type: "address" })],
        publicKey: address,
      });

      setTxState("signing");
      const txHash = await signAndSubmit(xdr);
      setTxState("confirming");

      // Wait a moment for state to settle, then reload
      await new Promise(r => setTimeout(r, 2000));
      await loadVault(address);

      setLastTxHash(txHash);
      setTxState("success");
    } catch (e: any) {
      // Contract error #3 = UserAlreadyHasVault — vault exists, just load it
      if (e?.message?.includes("#3") || e?.message?.includes("UserAlreadyHasVault")) {
        await loadVault(address);
        setTxState("success");
      } else {
        console.error("Create vault failed:", e);
        setTxState("error");
      }
    }
  }, [address]);

  const deposit = useCallback(async (usdc: number) => {
    if (!address || !vaultAddress) return;
    setTxState("building");
    setLastTxHash(undefined);
    try {
      const stroops = toStroops(usdc);
      const xdr = await buildContractTx({
        contractId: vaultAddress,
        method: "deposit",
        args: [
          nativeToScVal(address, { type: "address" }),
          nativeToScVal(stroops, { type: "i128" }),
        ],
        publicKey: address,
      });

      setTxState("signing");
      const txHash = await signAndSubmit(xdr);
      setTxState("confirming");

      await new Promise(r => setTimeout(r, 2000));
      await loadVault(address);

      setLastTxHash(txHash);
      setTxState("success");
    } catch (e) {
      console.error("Deposit failed:", e);
      setTxState("error");
    }
  }, [address, vaultAddress]);

  const withdraw = useCallback(async (usdc: number) => {
    if (!address || !vaultAddress) return;
    setTxState("building");
    setLastTxHash(undefined);
    try {
      const stroops = toStroops(usdc);
      const xdr = await buildContractTx({
        contractId: vaultAddress,
        method: "withdraw",
        args: [
          nativeToScVal(address, { type: "address" }),
          nativeToScVal(stroops, { type: "i128" }),
        ],
        publicKey: address,
      });

      setTxState("signing");
      const txHash = await signAndSubmit(xdr);
      setTxState("confirming");

      await new Promise(r => setTimeout(r, 2000));
      await loadVault(address);

      setLastTxHash(txHash);
      setTxState("success");
    } catch (e) {
      console.error("Withdraw failed:", e);
      setTxState("error");
    }
  }, [address, vaultAddress]);

  const addAgent = useCallback(async (agentAddress: string, dailyLimitUsdc: number) => {
    if (!address || !vaultAddress) return;
    setTxState("building");
    setLastTxHash(undefined);
    setTxError(null);
    try {
      const limitStroops = toStroops(dailyLimitUsdc);

      // If already authorized, update limit instead of re-adding
      const alreadyAuthorized = agents.some(a => a.address === agentAddress && a.isActive);
      const method = alreadyAuthorized ? "set_agent_limit" : "add_agent";
      const args = alreadyAuthorized
        ? [
            nativeToScVal(address, { type: "address" }),
            nativeToScVal(agentAddress, { type: "address" }),
            nativeToScVal(limitStroops, { type: "i128" }),
          ]
        : [
            nativeToScVal(address, { type: "address" }),
            nativeToScVal(agentAddress, { type: "address" }),
            nativeToScVal(limitStroops, { type: "i128" }),
            nativeToScVal([], { type: "vec" }),
          ];

      const xdr = await buildContractTx({
        contractId: vaultAddress,
        method,
        args,
        publicKey: address,
      });

      setTxState("signing");
      const txHash = await signAndSubmit(xdr);
      setTxState("confirming");

      await new Promise(r => setTimeout(r, 2000));
      await loadVault(address);

      setLastTxHash(txHash);
      setTxState("success");
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("#3") || msg.includes("NotOwner")) {
        setTxError("Only the vault owner can authorize agents.");
      } else {
        setTxError(null);
      }
      console.error("Add agent failed:", e);
      setTxState("error");
    }
  }, [address, vaultAddress, agents]);

  const resetTxState = useCallback(() => {
    setTxState("idle");
    setLastTxHash(undefined);
    setTxError(null);
  }, []);

  return {
    vaultAddress,
    balance,
    agents,
    loading,
    txState,
    txError,
    lastTxHash,
    createVault,
    deposit,
    withdraw,
    addAgent,
    resetTxState,
    refresh: vaultAddress ? () => loadVaultData(vaultAddress) : undefined,
  };
}
