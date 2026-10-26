import path from "node:path";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const MIGRATIONS = path.join(process.cwd(), "drizzle");

type Handle = { db: Db; driver: "postgres" | "pglite"; close: () => Promise<void> };

async function open(): Promise<Handle> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url });
    const db = drizzlePg(pool, { schema });
    await migratePg(db, { migrationsFolder: MIGRATIONS });
    return { db: db as unknown as Db, driver: "postgres", close: () => pool.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), "data", "pg");
  const client = new PGlite(dir);
  await client.waitReady;
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS });
  return { db: db as unknown as Db, driver: "pglite", close: () => client.close() };
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
