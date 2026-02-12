import { describe, it, expect } from "vitest";

describe("Facilitator", () => {
  it("should export settlePayment function", async () => {
    const { settlePayment } = await import("../../apps/backend/src/x402/facilitator.js");
    expect(typeof settlePayment).toBe("function");
  });

  it("should fail without facilitator key", async () => {
    const { settlePayment } = await import("../../apps/backend/src/x402/facilitator.js");
    const result = await settlePayment({
      x402Version: 1,
      scheme: "stellar-vault",
      network: "stellar:testnet",
      payload: {
        vaultContract: "CTEST", agentId: 1, agentSigner: "GTEST",
        payTo: "GTEST2", amount: "100000", asset: "USDC",
        memo: "test", signedAuthEntry: "", expirationLedger: 0,
      },
    });
    expect(result.success).toBe(false);
  });
});
