/**
 * Event Decoder — Converts raw Stellar/Soroban events into human-readable descriptions.
 *
 * Decodes:
 * - Vault events (deposit, withdraw, agent_pay, agent_added, agent_removed)
 * - Agent registry events (register, deactivate)
 * - Generic invoke_host_function operations
 */

import { formatUsdc } from "@stellaragent402/x402-stellar";

export interface DecodedEvent {
  type: "vault" | "payment" | "agent" | "other";
  description: string;
  amount?: string;
  amountFormatted?: string;
  from?: string;
  to?: string;
  agentAddress?: string;
  vaultAddress?: string;
  timestamp: string;
  txHash: string;
  ledger?: number;
}

/**
 * Shorten a Stellar address for display.
 */
export function shortenAddr(addr: string, chars = 4): string {
  if (!addr || addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

/**
 * Decode a vault deposit event.
 */
export function decodeVaultEvent(event: {
  topic?: string[];
  value?: any;
  contractId?: string;
  txHash: string;
  ledger?: number;
  timestamp?: number;
}): DecodedEvent {
  const topic = event.topic?.[0] || "";
  const ts = event.timestamp
    ? new Date(event.timestamp * 1000).toISOString()
    : new Date().toISOString();

  if (topic.includes("deposit")) {
    const amount = event.value?.amount || event.value?.[1];
    const from = event.value?.from || event.value?.[0];
    return {
      type: "vault",
      description: `Vault ${shortenAddr(event.contractId || "")} received deposit${from ? ` from ${shortenAddr(from)}` : ""}${amount ? ` of ${formatUsdc(String(amount))} USDC` : ""}`,
      amount: amount ? String(amount) : undefined,
      amountFormatted: amount ? `${formatUsdc(String(amount))} USDC` : undefined,
      from: from,
      vaultAddress: event.contractId,
      timestamp: ts,
      txHash: event.txHash,
      ledger: event.ledger,
    };
  }

  if (topic.includes("withdraw")) {
    const amount = event.value?.amount || event.value?.[1];
    const to = event.value?.to || event.value?.[0];
    return {
      type: "vault",
      description: `Vault ${shortenAddr(event.contractId || "")} withdrew${amount ? ` ${formatUsdc(String(amount))} USDC` : ""}${to ? ` to ${shortenAddr(to)}` : ""}`,
      amount: amount ? String(amount) : undefined,
      amountFormatted: amount ? `${formatUsdc(String(amount))} USDC` : undefined,
      to,
      vaultAddress: event.contractId,
      timestamp: ts,
      txHash: event.txHash,
      ledger: event.ledger,
    };
  }

  if (topic.includes("agent_pay")) {
    const agent = event.value?.[0];
    const payTo = event.value?.[1];
    const amount = event.value?.[2];
    const memo = event.value?.[3];
    return {
      type: "payment",
      description: `Agent ${shortenAddr(agent || "")} paid ${amount ? formatUsdc(String(amount)) : "?"} USDC to ${shortenAddr(payTo || "")}${memo ? ` (${memo})` : ""}`,
      amount: amount ? String(amount) : undefined,
      amountFormatted: amount ? `${formatUsdc(String(amount))} USDC` : undefined,
      from: agent,
      to: payTo,
      agentAddress: agent,
      vaultAddress: event.contractId,
      timestamp: ts,
      txHash: event.txHash,
      ledger: event.ledger,
    };
  }

  if (topic.includes("agent_added")) {
    const agent = event.value?.[0];
    const limit = event.value?.[1];
    return {
      type: "agent",
      description: `Agent ${shortenAddr(agent || "")} authorized${limit ? ` with ${formatUsdc(String(limit))} USDC daily limit` : ""}`,
      agentAddress: agent,
      vaultAddress: event.contractId,
      timestamp: ts,
      txHash: event.txHash,
      ledger: event.ledger,
    };
  }

  if (topic.includes("agent_removed")) {
    const agent = event.value?.[0];
    return {
      type: "agent",
      description: `Agent ${shortenAddr(agent || "")} deauthorized from vault ${shortenAddr(event.contractId || "")}`,
      agentAddress: agent,
      vaultAddress: event.contractId,
      timestamp: ts,
      txHash: event.txHash,
      ledger: event.ledger,
    };
  }

  return {
    type: "other",
    description: `Vault ${shortenAddr(event.contractId || "")} event: ${topic}`,
    vaultAddress: event.contractId,
    timestamp: ts,
    txHash: event.txHash,
    ledger: event.ledger,
  };
}

/**
 * Decode a payment event from agent_pay.
 */
export function decodePaymentEvent(event: {
  agentAddress?: string;
  serviceAddress?: string;
  amount?: string;
  memo?: string;
  txHash: string;
  ledger?: number;
  timestamp?: number;
}): DecodedEvent {
  const ts = event.timestamp
    ? new Date(event.timestamp * 1000).toISOString()
    : new Date().toISOString();

  return {
    type: "payment",
    description: `Agent ${shortenAddr(event.agentAddress || "")} paid ${event.amount ? formatUsdc(event.amount) : "?"} USDC${event.memo ? ` (${event.memo})` : ""}`,
    amount: event.amount,
    amountFormatted: event.amount ? `${formatUsdc(event.amount)} USDC` : undefined,
    from: event.agentAddress,
    to: event.serviceAddress,
    agentAddress: event.agentAddress,
    timestamp: ts,
    txHash: event.txHash,
    ledger: event.ledger,
  };
}

/**
 * Decode an agent registry event.
 */
export function decodeAgentEvent(event: {
  agentAddress?: string;
  agentName?: string;
  capabilities?: string[];
  topic?: string;
  txHash: string;
  ledger?: number;
  timestamp?: number;
}): DecodedEvent {
  const ts = event.timestamp
    ? new Date(event.timestamp * 1000).toISOString()
    : new Date().toISOString();

  const caps = event.capabilities?.join(", ") || "";

  return {
    type: "agent",
    description: `Agent ${shortenAddr(event.agentAddress || "")} registered${event.agentName ? `: ${event.agentName}` : ""}${caps ? ` [${caps}]` : ""}`,
    agentAddress: event.agentAddress,
    timestamp: ts,
    txHash: event.txHash,
    ledger: event.ledger,
  };
}

/**
 * Decode a raw Horizon operation into a human-readable description.
 */
export function decodeHorizonOperation(op: any): DecodedEvent {
  const ts = op.created_at || new Date().toISOString();
  const txHash = op.transaction_hash || "";

  switch (op.type) {
    case "invoke_host_function": {
      // Try to infer from function call details
      const fnType = op.function?.type || "";
      const params = op.parameters || [];
      if (fnType.includes("agent_pay") || (params.length >= 3 && op.function?.type === "invoke_contract")) {
        return {
          type: "payment",
          description: "x402 Agent Payment — vault.agent_pay()",
          timestamp: ts,
          txHash,
        };
      }
      return {
        type: "other",
        description: "Smart contract interaction",
        timestamp: ts,
        txHash,
      };
    }
    case "payment": {
      const asset = op.asset_type === "native" ? "XLM" : (op.asset_code || "USDC");
      const amount = parseFloat(op.amount || "0");
      const amountStr = asset === "XLM" ? `${amount.toFixed(2)} XLM` : `${amount.toFixed(2)} USDC`;
      return {
        type: "payment",
        description: `Payment: ${amountStr} to ${shortenAddr(op.to || "")}`,
        amount: op.amount,
        amountFormatted: amountStr,
        from: op.from,
        to: op.to,
        timestamp: ts,
        txHash,
      };
    }
    case "create_account":
      return {
        type: "other",
        description: `Account created: ${shortenAddr(op.account || "")}`,
        timestamp: ts,
        txHash,
      };
    case "change_trust":
      return {
        type: "other",
        description: `Trust line: ${op.asset_code || "asset"} (${op.trustor ? shortenAddr(op.trustor) : ""})`,
        timestamp: ts,
        txHash,
      };
    default:
      return {
        type: "other",
        description: (op.type || "unknown").replace(/_/g, " "),
        timestamp: ts,
        txHash,
      };
  }
}
