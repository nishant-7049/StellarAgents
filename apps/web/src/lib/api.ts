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
  return fetchAPI<{ agents: any[] }>("/api/agents");
}

export async function fetchStats() {
  return fetchAPI<any>("/api/stats");
}

/**
 * Build a real x402 payment header via the backend.
 * The backend signs the auth entry with the agent signer key.
 */
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

/**
 * Fetch transaction history from Horizon API.
 */
export async function fetchTransactionHistory(accountId: string, limit = 20) {
  const res = await fetch(
    `https://horizon-testnet.stellar.org/accounts/${accountId}/operations?limit=${limit}&order=desc`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data._embedded?.records || [];
}
