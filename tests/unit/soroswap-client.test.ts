import { describe, it, expect } from "vitest";

describe("Soroswap Client", () => {
  it("should return pool data", async () => {
    const { soroswapClient } = await import("../../apps/backend/src/defi/soroswap-client.js");
    const pools = await soroswapClient.getPools();
    expect(pools.length).toBeGreaterThan(0);
    expect(pools[0].apy).toBeGreaterThan(0);
  });

  it("should return mock swap quote", async () => {
    const { soroswapClient } = await import("../../apps/backend/src/defi/soroswap-client.js");
    const quote = await soroswapClient.getQuote({
      assetIn: "USDC", assetOut: "XLM", amount: 100_0000000n,
    });
    expect(quote).toBeTruthy();
    expect(quote.protocol).toContain("soroswap");
  });
});
