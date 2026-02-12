import { describe, it, expect } from "vitest";
import { getRebalancerStatus, setTargetAllocation } from "../../apps/backend/src/defi/rebalancer.js";
import { blendClient } from "../../apps/backend/src/defi/blend-client.js";
import { soroswapClient } from "../../apps/backend/src/defi/soroswap-client.js";

describe("Rebalance Flow", () => {
  it("should set target allocation and verify status", () => {
    setTargetAllocation([
      { protocol: "blend", asset: "USDC", targetPct: 60, currentPct: 50 },
      { protocol: "soroswap", asset: "USDC/XLM", targetPct: 40, currentPct: 50 },
    ]);

    const status = getRebalancerStatus();
    expect(status.running).toBe(true);
    expect(status.lastStrategy.length).toBe(2);
    expect(status.lastStrategy[0].targetPct).toBe(60);
    expect(status.lastStrategy[1].targetPct).toBe(40);
  });

  it("should fetch pool data for rebalance decisions", async () => {
    const blendData = await blendClient.loadPool();
    const soroswapPools = await soroswapClient.getPools();

    expect(blendData.reserves.length).toBeGreaterThan(0);
    expect(soroswapPools.length).toBeGreaterThan(0);

    // Verify we have data to make rebalance decisions
    const usdcReserve = blendData.reserves.find(r => r.symbol === "USDC");
    expect(usdcReserve).toBeTruthy();
    expect(usdcReserve!.supplyApy).toBeGreaterThan(0);
  }, 30_000);

  it("should get swap quote for rebalancing", async () => {
    const quote = await soroswapClient.getQuote({
      assetIn: "USDC",
      assetOut: "XLM",
      amount: 100_0000000n,
    });

    expect(quote).toBeTruthy();
    expect(quote!.amountOut).toBeTruthy();
    expect(Number(quote!.amountOut)).toBeGreaterThan(0);
  });
});
