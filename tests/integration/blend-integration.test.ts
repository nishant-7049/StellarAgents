import { describe, it, expect } from "vitest";
import { blendClient } from "../../apps/backend/src/defi/blend-client.js";

describe("Blend Protocol Integration", () => {
  it("should load pool data from Blend (or fallback to mock)", async () => {
    const pool = await blendClient.loadPool();
    expect(pool.poolId).toBeTruthy();
    expect(pool.reserves.length).toBeGreaterThan(0);
    expect(pool.reserves[0].supplyApy).toBeGreaterThan(0);
    expect(pool.reserves[0].symbol).toBeTruthy();
  }, 30_000);

  it("should have valid reserve data structure", async () => {
    const pool = await blendClient.loadPool();
    for (const reserve of pool.reserves) {
      expect(typeof reserve.assetId).toBe("string");
      expect(typeof reserve.symbol).toBe("string");
      expect(typeof reserve.supplyApy).toBe("number");
      expect(typeof reserve.borrowApy).toBe("number");
      expect(typeof reserve.utilization).toBe("number");
      expect(reserve.utilization).toBeGreaterThanOrEqual(0);
      expect(reserve.utilization).toBeLessThanOrEqual(1);
    }
  }, 30_000);

  it("should build a supply operation", () => {
    const opXdr = blendClient.buildSupplyOp({
      poolId: "CBP7NO6F7FRDHSOFQBT2L2UWYIZ2PU76JKVRYAQTG3KZSQLYAOKIF2WB",
      from: "GABC123456789ABCDEF",
      asset: "CUSDC123456789ABCDEF",
      amount: 100_0000000n,
    });
    expect(opXdr).toBeTruthy();
    expect(typeof opXdr).toBe("string");
  });

  it("should build a withdraw operation", () => {
    const opXdr = blendClient.buildWithdrawOp({
      poolId: "CBP7NO6F7FRDHSOFQBT2L2UWYIZ2PU76JKVRYAQTG3KZSQLYAOKIF2WB",
      from: "GABC123456789ABCDEF",
      asset: "CUSDC123456789ABCDEF",
      amount: 50_0000000n,
    });
    expect(opXdr).toBeTruthy();
    expect(typeof opXdr).toBe("string");
  });
});
