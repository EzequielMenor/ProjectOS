import path from "node:path";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { bundledMigrationQueries } from "./bundled-migrations";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const MIGRATIONS = path.join(process.cwd(), "drizzle");

/** True when running as the public interactive sandbox (e.g., DEMO_MODE=1 or free Vercel deployment without DATABASE_URL). */
export function isDemoMode(): boolean {
  const flag = process.env.DEMO_MODE?.toLowerCase();
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  return process.env.VERCEL === "1" && !process.env.DATABASE_URL;
}

type Handle = { db: Db; driver: "postgres" | "pglite"; close: () => Promise<void> };

async function open(): Promise<Handle> {
  const demo = isDemoMode();
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url });
    const db = drizzlePg(pool, { schema });
    try {
      await migratePg(db, { migrationsFolder: MIGRATIONS });
    } catch {
      const internal = db as unknown as { dialect: { migrate: (q: unknown, s: unknown, c: unknown) => Promise<void> }; session: unknown };
      await internal.dialect.migrate(bundledMigrationQueries, internal.session, {});
    }
    const typedDb = db as unknown as Db;
    if (demo) {
      const { seedDemoData } = await import("@/server/services/demo");
      await seedDemoData(typedDb);
    }
    return { db: typedDb, driver: "postgres", close: () => pool.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR ?? (demo ? "memory://" : path.join(process.cwd(), "data", "pg"));
  const client = new PGlite(dir);
  await client.waitReady;
  const db = drizzlePglite(client, { schema });
  // In serverless / Vercel bundles, files on disk in `./drizzle` might not exist at runtime.
  // We try migratePglite and fall back to bundled migrations in memory.
  try {
    await migratePglite(db, { migrationsFolder: MIGRATIONS });
  } catch (err) {
    console.warn("[projectos] Usando migraciones empaquetadas en memoria para PGlite:", err instanceof Error ? err.message : err);
    const internal = db as unknown as { dialect: { migrate: (q: unknown, s: unknown, c: unknown) => Promise<void> }; session: unknown };
    await internal.dialect.migrate(bundledMigrationQueries, internal.session, {});
  }
  const typedDb = db as unknown as Db;
  if (demo) {
    const { seedDemoData } = await import("@/server/services/demo");
    await seedDemoData(typedDb);
  }
  return { db: typedDb, driver: "pglite", close: () => client.close() };
}

const g = globalThis as unknown as { __projectosDb?: Promise<Handle> };

/** Lazily opens (and migrates) the database once per process; survives dev hot reloads. */
export function getHandle(): Promise<Handle> {
  g.__projectosDb ??= open();
  return g.__projectosDb;
}

export async function getDb(): Promise<Db> {
  return (await getHandle()).db;
}
