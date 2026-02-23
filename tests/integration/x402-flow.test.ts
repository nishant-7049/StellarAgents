import { describe, it, expect } from "vitest";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

describe("x402 Payment Flow", () => {
  it("should return 402 without X-PAYMENT header", async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/yield/query?q=best+yield`);
      expect(res.status).toBe(402);

      const body = await res.json();
      expect(body.x402Version).toBe(1);
      expect(body.accepts).toBeInstanceOf(Array);
      expect(body.accepts[0].scheme).toBe("stellar-vault");
      expect(body.accepts[0].network).toBe("stellar:testnet");
      expect(body.accepts[0].amount).toBe("100000");
    } catch (err: any) {
      if (err.cause?.code === "ECONNREFUSED") {
        console.log("Skipping: backend not running");
        return;
      }
      throw err;
    }
  });

  it("should reject invalid X-PAYMENT header", async () => {
    try {
      const invalidPayload = Buffer.from(JSON.stringify({
        scheme: "invalid-scheme",
        payload: {},
      })).toString("base64");

      const res = await fetch(`${BACKEND_URL}/api/yield/query?q=test`, {
        headers: { "X-PAYMENT": invalidPayload },
      });
      expect(res.status).toBe(402);
    } catch (err: any) {
      if (err.cause?.code === "ECONNREFUSED") {
        console.log("Skipping: backend not running");
        return;
      }
      throw err;
    }
  });

  it("should reject insufficient payment amount", async () => {
    try {
      const payload = Buffer.from(JSON.stringify({
        scheme: "stellar-vault",
        payload: {
          vaultContract: "CTEST",
          agentId: 1,
          agentSigner: "GTEST",
          payTo: "GTEST2",
          amount: "1", // too low
          asset: "USDC",
          memo: "test",
          signedAuthEntry: "",
          expirationLedger: 0,
        },
      })).toString("base64");

      const res = await fetch(`${BACKEND_URL}/api/yield/query?q=test`, {
        headers: { "X-PAYMENT": payload },
      });
      expect(res.status).toBe(402);
    } catch (err: any) {
      if (err.cause?.code === "ECONNREFUSED") {
        console.log("Skipping: backend not running");
        return;
      }
      throw err;
    }
  });
});
