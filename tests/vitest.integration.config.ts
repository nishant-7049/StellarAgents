import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: "./tests",
    include: ["integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
  },
});
