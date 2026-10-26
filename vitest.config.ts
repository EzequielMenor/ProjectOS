import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    env: { PGLITE_DIR: "memory://", DATABASE_URL: "" },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
