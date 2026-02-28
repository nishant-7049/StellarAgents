import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: "./tests",
    include: ["unit/**/*.test.ts"],
    environment: "node",
    testTimeout: 10_000,
  },
});
