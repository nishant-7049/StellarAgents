import { describe, it, expect } from "vitest";

describe("Rebalancer", () => {
  it("should export rebalancer functions", async () => {
    const mod = await import("../../apps/backend/src/defi/rebalancer.js");
    expect(typeof mod.startRebalancer).toBe("function");
    expect(typeof mod.setTargetAllocation).toBe("function");
    expect(typeof mod.getRebalancerStatus).toBe("function");
  });

  it("should return status", async () => {
    const { getRebalancerStatus } = await import("../../apps/backend/src/defi/rebalancer.js");
    const status = getRebalancerStatus();
    expect(status.running).toBe(true);
    expect(status.driftThreshold).toBeGreaterThan(0);
  });
});
