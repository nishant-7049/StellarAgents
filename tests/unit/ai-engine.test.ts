import { describe, it, expect } from "vitest";

describe("AI Engine", () => {
  it("should have a system prompt defined", async () => {
    const { SYSTEM_PROMPT } = await import("../../apps/backend/src/ai/prompts.js");
    expect(SYSTEM_PROMPT).toBeDefined();
    expect(SYSTEM_PROMPT).toContain("DeFi yield optimization");
    expect(SYSTEM_PROMPT).toContain("allocation_pct");
  });

  it("should build user prompt with context", async () => {
    const { buildUserPrompt } = await import("../../apps/backend/src/ai/prompts.js");
    const prompt = buildUserPrompt("best yield", "BLEND: 7%", "moderate", 1000);
    expect(prompt).toContain("best yield");
    expect(prompt).toContain("moderate");
    expect(prompt).toContain("1000 USDC");
    expect(prompt).toContain("BLEND: 7%");
  });
});
