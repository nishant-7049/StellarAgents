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
  const headers: Record<string, string> = {};
  if (paymentHeader) headers["X-PAYMENT"] = paymentHeader;
  const res = await fetch(`${BACKEND_URL}/api/yield/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
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
