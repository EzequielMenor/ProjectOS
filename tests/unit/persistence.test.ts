import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";

// Real on-disk PGlite: data written by one process-lifetime must be readable after close + reopen.
describe("persistence across restarts", () => {
  it("keeps rows after closing and reopening the data dir", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "projectos-persist-"));
    const open = async () => {
      const client = new PGlite(dir);
      await client.waitReady;
      const db = drizzle(client, { schema });
      await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
      return { client, db };
    };
    const first = await open();
    const [ws] = await first.db.insert(schema.workspace).values({ name: "W", slug: "w" }).returning();
    await first.client.close();

    const second = await open();
    const rows = await second.db.select().from(schema.workspace).where(eq(schema.workspace.slug, "w"));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(ws.id);
    await second.client.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
