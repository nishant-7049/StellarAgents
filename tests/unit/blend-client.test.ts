import { describe, it, expect } from "vitest";

describe("Blend Client", () => {
  it("should return mock pool data", async () => {
    const { blendClient } = await import("../../apps/backend/src/defi/blend-client.js");
    const pool = await blendClient.loadPool();
    expect(pool.poolId).toBeTruthy();
    expect(pool.reserves.length).toBeGreaterThan(0);
    expect(pool.reserves[0].symbol).toBe("USDC");
    expect(pool.reserves[0].supplyApy).toBeGreaterThan(0);
  });

  it("should have USDC and XLM reserves", async () => {
    const { blendClient } = await import("../../apps/backend/src/defi/blend-client.js");
    const pool = await blendClient.loadPool();
    const symbols = pool.reserves.map(r => r.symbol);
    expect(symbols).toContain("USDC");
    expect(symbols).toContain("XLM");
  });
});
