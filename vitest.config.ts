import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    // BACKUP_DIR: tests that restore a copy write a pre-restore one; keep those out of ./data/backups
    env: { PGLITE_DIR: "memory://", DATABASE_URL: "", BACKUP_DIR: path.join(os.tmpdir(), "projectos-unit-backups"), AUTO_BACKUP: "off" },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
