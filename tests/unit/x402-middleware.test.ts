import { describe, it, expect } from "vitest";

describe("x402 Middleware", () => {
  it("should export x402Middleware function", async () => {
    const { x402Middleware } = await import("../../apps/backend/src/middleware/x402.middleware.js");
    expect(typeof x402Middleware).toBe("function");
  });

  it("should create middleware with config", async () => {
    const { x402Middleware } = await import("../../apps/backend/src/middleware/x402.middleware.js");
    const middleware = x402Middleware({ price: "100000", description: "test" });
    expect(typeof middleware).toBe("function");
  });
});
