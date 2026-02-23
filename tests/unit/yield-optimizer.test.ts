import { describe, it, expect } from "vitest";

describe("Yield Optimizer", () => {
  it("should return fallback strategy without API key", async () => {
    const { YieldOptimizer } = await import("../../apps/backend/src/ai/yield-optimizer.js");
    const optimizer = new YieldOptimizer();
    const result = await optimizer.optimize("best yield", "moderate");
    expect(result.strategies.length).toBeGreaterThan(0);
    expect(result.total_estimated_apy).toBeGreaterThan(0);
    expect(result.summary).toBeTruthy();
    expect(result.disclaimer).toBeTruthy();
  });

  it("should respect risk tolerance", async () => {
    const { YieldOptimizer } = await import("../../apps/backend/src/ai/yield-optimizer.js");
    const optimizer = new YieldOptimizer();
    const low = await optimizer.optimize("yield", "low");
    const high = await optimizer.optimize("yield", "high");
    expect(low.total_estimated_apy).toBeLessThan(high.total_estimated_apy);
  });

  it("should sum allocations to 100%", async () => {
    const { YieldOptimizer } = await import("../../apps/backend/src/ai/yield-optimizer.js");
    const optimizer = new YieldOptimizer();
    const result = await optimizer.optimize("yield", "moderate");
    const total = result.strategies.reduce((sum, s) => sum + s.allocation_pct, 0);
    expect(total).toBe(100);
  });
});
