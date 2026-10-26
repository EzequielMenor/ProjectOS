import fs from "node:fs";
import path from "node:path";
import { getTableColumns, getTableName, sql, type AnyColumn } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import { getDb, type Db } from "@/db/client";
import * as s from "@/db/schema";
import { ServiceError, invalid } from "../errors";
import { resetWorkspaceCache } from "./workspace";

export const BACKUP_FORMAT = "projectos-backup";
export const BACKUP_VERSION = 1;

/** Dependency order: parents before children. api_token is excluded on purpose (secrets); see restore. */
const TABLES = [
  ["workspace", s.workspace],
  ["member", s.member],
  ["project", s.project],
  ["state", s.state],
  ["issue", s.issue],
  ["label", s.label],
  ["issue_label", s.issueLabel],
  ["issue_relation", s.issueRelation],
  ["comment", s.comment],
  ["issue_link", s.issueLink],
  ["activity", s.activity],
] as const satisfies readonly (readonly [string, PgTable])[];

type Row = Record<string, unknown>;

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().max(BACKUP_VERSION, "La copia es de una versión más nueva de ProjectOS"),
  createdAt: z.string(),
  counts: z.record(z.string(), z.number()),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});
export type Backup = z.infer<typeof backupSchema>;

export async function createBackup(): Promise<Backup> {
  const db = await getDb();
  const tables: Record<string, Row[]> = {};
  for (const [name, table] of TABLES) tables[name] = (await db.select().from(table)) as Row[];
  // Round-trip through JSON so Dates become the exact strings that end up on disk.
  return JSON.parse(
    JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])),
      tables,
    }),
  );
}

export function backupDir() {
  return process.env.BACKUP_DIR ?? path.join(process.cwd(), "data", "backups");
}

export async function saveBackupToDisk(label = "backup") {
  const data = await createBackup();
  fs.mkdirSync(backupDir(), { recursive: true });
  const file = path.join(backupDir(), `${label}-${data.createdAt.replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(data), { mode: 0o600 });
  return { file, counts: data.counts };
}

export function listBackups() {
  if (!fs.existsSync(backupDir())) return [];
  return fs
    .readdirSync(backupDir())
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ name: f, size: fs.statSync(path.join(backupDir(), f)).size, mtime: fs.statSync(path.join(backupDir(), f)).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

export function parseBackup(raw: unknown): Backup {
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) throw invalid(`Archivo de copia no válido: ${parsed.error.issues[0]?.message ?? "formato"}`);
  const b = parsed.data;
  for (const [name] of TABLES) {
    const rows = b.tables[name];
    if (!rows) throw invalid(`Falta la tabla "${name}" en la copia`);
    if (b.counts[name] !== rows.length) throw invalid(`La tabla "${name}" está incompleta (${rows.length} de ${b.counts[name]} filas)`);
  }
  return b;
}

/** Revives JSON strings into Dates for timestamp columns. */
function revive(table: PgTable, row: Row): Row {
  const cols = getTableColumns(table) as Record<string, AnyColumn>;
  const out: Row = {};
  for (const [key, col] of Object.entries(cols)) {
    const v = row[key];
    out[key] = v != null && col.columnType === "PgTimestamp" ? new Date(v as string) : v;
  }
  return out;
}

async function batchInsert(tx: Pick<Db, "insert">, table: PgTable, rows: Row[]) {
  for (let i = 0; i < rows.length; i += 500) await tx.insert(table).values(rows.slice(i, i + 500) as never);
}

export type RestoreResult = { dryRun: boolean; counts: Record<string, number>; preRestoreBackup?: string };

/**
 * Restores a backup. Refuses to touch a database that already has projects unless `replace` is set;
 * in that case a safety copy of the current data is written first, and everything runs in one transaction.
 */
export async function restoreBackup(raw: unknown, opts: { dryRun?: boolean; replace?: boolean } = {}): Promise<RestoreResult> {
  const data = parseBackup(raw);
  const db = await getDb();
  const existing = await db.select({ n: sql<number>`count(*)::int` }).from(s.project);
  const hasData = existing[0].n > 0;
  if (hasData && !opts.replace) {
    throw new ServiceError("conflict", "La base de datos ya tiene proyectos. Usa la opción de reemplazar (se guarda antes una copia de seguridad).");
  }
  if (opts.dryRun) return { dryRun: true, counts: data.counts };

  const pre = hasData ? await saveBackupToDisk("pre-restore") : undefined;
  const tokens = await db.select().from(s.apiToken);

  await db.transaction(async (tx) => {
    await tx.execute(sql`TRUNCATE ${sql.join([...TABLES].map(([, t]) => sql.identifier(getTableName(t))), sql`, `)}, ${sql.identifier("api_token")} CASCADE`);
    for (const [name, table] of TABLES) {
      const rows = data.tables[name].map((r) => revive(table, r));
      if (name === "issue") {
        // self-reference: insert flat, then link parents
        await batchInsert(tx, table, rows.map((r) => ({ ...r, parentId: null })));
        for (const r of rows.filter((x) => x.parentId)) {
          await tx.update(s.issue).set({ parentId: r.parentId as string }).where(sql`${s.issue.id} = ${r.id as string}`);
        }
        continue;
      }
      await batchInsert(tx, table, rows);
    }
    const ws = data.tables.workspace[0];
    if (tokens.length && ws) await tx.insert(s.apiToken).values(tokens.map((t) => ({ ...t, workspaceId: ws.id as string })));
  });
  resetWorkspaceCache();
  return { dryRun: false, counts: data.counts, preRestoreBackup: pre?.file };
}
