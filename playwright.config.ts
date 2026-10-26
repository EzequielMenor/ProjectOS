import { defineConfig } from "@playwright/test";
import os from "node:os";
import path from "node:path";

const PORT = 3101;
// Fresh database per run (wiped in the server command: webServer starts before globalSetup).
const PGLITE_DIR = path.join(os.tmpdir(), "projectos-e2e-pg");

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  webServer: {
    command: `rm -rf ${PGLITE_DIR} && pnpm exec next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/projects/new`,
    env: { PGLITE_DIR, NEXT_DIST_DIR: ".next-e2e", BACKUP_DIR: path.join(os.tmpdir(), "projectos-e2e-backups"), AUTO_BACKUP: "off" },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
