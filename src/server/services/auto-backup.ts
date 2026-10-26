import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/db/client";
import { project } from "@/db/schema";
import { backupDir, saveBackupToDisk } from "./backup";

const PREFIX = "auto";
const HOUR = 3_600_000;

type Opts = {
  /** Copies kept; older automatic ones are deleted. Manual and pre-restore/import copies are never touched. */
  keep?: number;
  /** A new copy is only taken when the newest automatic one is at least this old. */
  everyHours?: number;
  now?: Date;
};

/** Automatic copies, newest first (the timestamp in the name sorts chronologically). */
function autoCopies() {
  if (!fs.existsSync(backupDir())) return [];
  return fs
    .readdirSync(backupDir())
    .filter((f) => f.startsWith(`${PREFIX}-`) && f.endsWith(".json"))
    .sort()
    .reverse();
}

/**
 * Rolling safety net: at most one copy per `everyHours`, keeping the last `keep`. An empty database is not copied,
 * so a wipe can never push the good copies out of the rotation.
 */
export async function runAutoBackup({ keep = 14, everyHours = 20, now = new Date() }: Opts = {}) {
  const db = await getDb();
  if (!(await db.select({ id: project.id }).from(project).limit(1)).length) return { skipped: "empty" as const };

  const newest = autoCopies()[0];
  if (newest) {
    const age = now.getTime() - fs.statSync(path.join(backupDir(), newest)).mtime.getTime();
    if (age < everyHours * HOUR) return { skipped: "recent" as const };
  }

  const saved = await saveBackupToDisk(PREFIX);
  const pruned = autoCopies().slice(keep);
  for (const f of pruned) fs.rmSync(path.join(backupDir(), f), { force: true });
  return { saved: saved.file, pruned: pruned.length };
}
