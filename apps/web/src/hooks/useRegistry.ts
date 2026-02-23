"use client";
import { useState, useEffect, useCallback } from "react";
import { nativeToScVal } from "@stellar/stellar-sdk";
import { useWallet } from "./useWallet";
import { buildContractTx, signAndSubmit, readContract, type TxState } from "@/lib/stellar";
import { AGENT_REGISTRY_ADDRESS } from "@/lib/contracts";

export interface AgentData {
  id: number;
  name: string;
  owner: string;
  agent_uri: string;
  vault_address: string;
  agent_signer: string;
  is_active: boolean;
  capabilities?: string[];
  pricing?: { amount: string };
  status?: string;
}

export function useRegistry() {
  const { address } = useWallet();
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [txState, setTxState] = useState<TxState>("idle");
  const [lastTxHash, setLastTxHash] = useState<string | undefined>();
  const [registeredId, setRegisteredId] = useState<number | null>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    setLoading(true);
    try {
      const raw = await readContract<any[]>(
        AGENT_REGISTRY_ADDRESS,
        "list_agents",
        [
          nativeToScVal(1, { type: "u32" }),
          nativeToScVal(20, { type: "u32" }),
        ],
      );

      const parsed: AgentData[] = (raw || []).map((a: any) => {
        // Parse agent_uri JSON for capabilities/pricing
        let capabilities: string[] = [];
        let pricing: { amount: string } | undefined;
        try {
          const uri = JSON.parse(a.agent_uri || "{}");
          capabilities = uri.capabilities || [];
          pricing = uri.pricing;
        } catch {}

        return {
          id: Number(a.id),
          name: a.name || `Agent #${a.id}`,
          owner: a.owner,
          agent_uri: a.agent_uri || "{}",
          vault_address: a.vault_address || "",
          agent_signer: a.agent_signer || "",
          is_active: a.is_active ?? true,
          capabilities,
          pricing,
          status: a.is_active ? "active" : "inactive",
        };
      });
      setAgents(parsed);
    } catch (e) {
      console.error("Failed to load agents:", e);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }

  const registerAgent = useCallback(async (params: {
    name: string;
    capabilities: string[];
    pricing: string;
    vaultAddress: string;
    agentSigner: string;
  }) => {
    if (!address) return;
    setTxState("building");
    setLastTxHash(undefined);
    setRegisteredId(null);

    try {
      const uri = JSON.stringify({
        capabilities: params.capabilities,
        pricing: { protocol: "x402", amount: params.pricing, asset: "USDC" },
        version: "0.1.0",
      });

      const xdr = await buildContractTx({
        contractId: AGENT_REGISTRY_ADDRESS,
        method: "register",
        args: [
          nativeToScVal(address, { type: "address" }),
          nativeToScVal(params.name, { type: "string" }),
          nativeToScVal(uri, { type: "string" }),
          nativeToScVal(params.vaultAddress, { type: "address" }),
          nativeToScVal(params.agentSigner, { type: "address" }),
        ],
        publicKey: address,
      });

      setTxState("signing");
      const txHash = await signAndSubmit(xdr);
      setTxState("confirming");

      // Read the agent ID by checking next_id
      await new Promise(r => setTimeout(r, 2000));
      try {
        const nextId = await readContract<number>(AGENT_REGISTRY_ADDRESS, "next_id", []);
        setRegisteredId(nextId - 1);
      } catch {
        setRegisteredId(null);
      }

      await loadAgents();
      setLastTxHash(txHash);
      setTxState("success");
    } catch (e) {
      console.error("Register agent failed:", e);
      setTxState("error");
    }
  }, [address]);

  const resetTxState = useCallback(() => {
    setTxState("idle");
    setLastTxHash(undefined);
  }, []);

  return { agents, loading, txState, lastTxHash, registeredId, registerAgent, resetTxState, refresh: loadAgents };
}
