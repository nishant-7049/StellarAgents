const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok && res.status !== 402) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

export async function fetchYieldQuery(query: string, risk: string, paymentHeader?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (paymentHeader) headers["X-PAYMENT"] = paymentHeader;
  const res = await fetch(`${BACKEND_URL}/api/yield/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, risk_tolerance: risk }),
  });
  return { status: res.status, data: await res.json() };
}

export async function fetchAgents() {
  return fetchAPI<{ agents: any[]; totalActive: number }>("/api/agents");
}

export async function fetchStats() {
  return fetchAPI<any>("/api/stats");
}

export async function fetchReputationSummary(agentId: number) {
  return fetchAPI<any>(`/api/reputation/${agentId}/summary`);
}

export async function fetchFeedback(agentId: number, offset = 0, limit = 10) {
  return fetchAPI<{ agentId: number; feedback: any[]; offset: number; limit: number }>(
    `/api/reputation/${agentId}/feedback?offset=${offset}&limit=${limit}`
  );
}

export async function fetchValidations(agentId: number) {
  return fetchAPI<{ agentId: number; validations: any[] }>(`/api/validation/${agentId}`);
}

export async function fetchEvents(contractId?: string, limit = 50) {
  const params = new URLSearchParams();
  if (contractId) params.set("contractId", contractId);
  params.set("limit", limit.toString());
  return fetchAPI<{ events: any[]; count: number }>(`/api/events?${params.toString()}`);
}

export async function buildX402Header(params: {
  vaultContract: string;
  payTo: string;
  amount: string;
  memo?: string;
}): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/api/x402/build-header`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Build header failed: ${res.status}`);
  }
  const data = await res.json();
  return data.header;
}

export async function fetchTransactionHistory(accountId: string, limit = 20) {
  // For Soroban contracts (start with 'C'), use backend events endpoint
  if (accountId.startsWith('C')) {
    try {
      const events = await fetchEvents(accountId, limit);
      return events.events.map((evt: any, i: number) => ({
        id: `${evt.ledger}-${i}`,
        type: "invoke_host_function",
        created_at: new Date(evt.timestamp || Date.now()).toISOString(),
        transaction_hash: evt.txHash || `ledger-${evt.ledger}`,
        topic: evt.topic,
      }));
    } catch {
      return [];
    }
  }

  // For regular accounts, use Horizon
  const res = await fetch(
    `https://horizon-testnet.stellar.org/accounts/${accountId}/operations?limit=${limit}&order=desc`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data._embedded?.records || [];
}
