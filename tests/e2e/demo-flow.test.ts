import { describe, it, expect } from "vitest";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

describe("Demo Flow (E2E)", () => {
  it("Step 1: Health check passes", async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/health`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("ok");
      expect(body.version).toBe("0.1.0");
      expect(body.network).toBe("testnet");
    } catch (err: any) {
      if (err.cause?.code === "ECONNREFUSED") {
        console.log("Skipping: backend not running at", BACKEND_URL);
        return;
      }
      throw err;
    }
  });

  it("Step 2: Yield query returns 402 without payment", async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/yield/query?q=best+yield+strategy&risk=moderate`);
      expect(res.status).toBe(402);

      const body = await res.json();
      expect(body.x402Version).toBe(1);
      expect(body.accepts).toHaveLength(1);

      const accept = body.accepts[0];
      expect(accept.scheme).toBe("stellar-vault");
      expect(accept.network).toBe("stellar:testnet");
      expect(accept.amount).toBe("100000");
      expect(accept.description).toContain("yield");
    } catch (err: any) {
      if (err.cause?.code === "ECONNREFUSED") {
        console.log("Skipping: backend not running");
        return;
      }
      throw err;
    }
  });

  it("Step 3: Rebalancer status is accessible", async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/rebalance/status`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.running).toBe(true);
      expect(body.driftThreshold).toBeGreaterThan(0);
    } catch (err: any) {
      if (err.cause?.code === "ECONNREFUSED") {
        console.log("Skipping: backend not running");
        return;
      }
      throw err;
    }
  });

  it("Step 4: Stats endpoint returns data", async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/stats`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty("network");
      expect(body.network).toBe("testnet");
    } catch (err: any) {
      if (err.cause?.code === "ECONNREFUSED") {
        console.log("Skipping: backend not running");
        return;
      }
      throw err;
    }
  });

  it("Step 5: Agent list endpoint works", async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/agents`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty("agents");
      expect(Array.isArray(body.agents)).toBe(true);
    } catch (err: any) {
      if (err.cause?.code === "ECONNREFUSED") {
        console.log("Skipping: backend not running");
        return;
      }
      throw err;
    }
  });
});
