/* ProjectOS maintenance CLI: `pnpm projectos backup [file]` / `pnpm projectos restore <file> [--dry-run] [--replace]`.
 * With the embedded PGlite database, stop the app first (one process may own the data dir);
 * with DATABASE_URL (Postgres) it can run alongside the app. */
import fs from "node:fs";
import path from "node:path";
import { getHandle } from "@/db/client";
import { createBackup, restoreBackup, saveBackupToDisk, backupDir } from "@/server/services/backup";
import { importPlaneSnapshot, parseSnapshot, type ImportReport } from "@/server/import/plane";
import { fetchPlaneSnapshot } from "@/server/import/plane-fetch";

const [cmd, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith("--") && !a.includes("=")).map((a) => a));
const opts = Object.fromEntries(rest.filter((a) => a.startsWith("--") && a.includes("=")).map((a) => [a.slice(2, a.indexOf("=")), a.slice(a.indexOf("=") + 1)]));
const args = rest.filter((a) => !a.startsWith("--"));

function printReports(reports: ImportReport[]) {
  for (const r of reports) {
    console.log(`\n${r.identifier}: ${r.status}${r.reason ? ` — ${r.reason}` : ""}`, r.counts);
    for (const w of r.warnings) console.log(`  aviso: ${w}`);
    for (const e of r.errors) console.log(`  ERROR: ${e}`);
  }
}

async function importPlane() {
  const dryRun = flags.has("--dry-run");
  const only = opts.only?.split(",").map((x) => x.trim()).filter(Boolean);
  const expected = opts.expect
    ? Object.fromEntries(opts.expect.split(",").map((kv) => kv.split(":")).map(([k, v]) => [k.trim().toUpperCase(), Number(v)]))
    : undefined;
  let snapshot;
  if (opts.from) snapshot = parseSnapshot(JSON.parse(fs.readFileSync(opts.from, "utf8")));
  else {
    const apiKey = process.env.PLANE_API_KEY;
    if (!apiKey || !opts.workspace) throw new Error("Uso: PLANE_API_KEY=… projectos import plane --workspace=<slug> [--only=FICH,AIES] [--expect=FICH:31] [--dry-run] | --from=<snapshot.json>");
    snapshot = await fetchPlaneSnapshot({ apiKey, workspace: opts.workspace, baseUrl: opts["base-url"], only, onProgress: (m) => console.log(m) });
    const dir = path.join(path.dirname(backupDir()), "imports");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `plane-${opts.workspace}-${snapshot.fetchedAt.replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(file, JSON.stringify(snapshot), { mode: 0o600 });
    console.log(`Snapshot crudo guardado en ${file} (reutilizable con --from=)`);
  }
  const plan = await importPlaneSnapshot(snapshot, { dryRun: true, only, expected });
  printReports(plan);
  if (dryRun) return console.log("\nSimulación: no se ha escrito nada en ProjectOS (ni se ha modificado nada en Plane).");
  if (plan.some((r) => r.status === "invalid")) throw new Error("Hay errores de validación; corrígelos o excluye el proyecto con --only=");
  if (!plan.some((r) => r.status === "planned")) return console.log("\nNada que importar.");
  const backup = await saveBackupToDisk("pre-import-plane");
  console.log(`\nCopia previa en ${backup.file}`);
  printReports(await importPlaneSnapshot(snapshot, { only, expected }));
}

async function main() {
  if (cmd === "backup") {
    if (args[0]) {
      const data = await createBackup();
      fs.mkdirSync(path.dirname(path.resolve(args[0])), { recursive: true });
      fs.writeFileSync(args[0], JSON.stringify(data), { mode: 0o600 });
      console.log(`Copia escrita en ${args[0]}`, data.counts);
    } else {
      const r = await saveBackupToDisk();
      console.log(`Copia escrita en ${r.file}`, r.counts);
    }
  } else if (cmd === "restore") {
    if (!args[0]) throw new Error("Uso: projectos restore <archivo.json> [--dry-run] [--replace]");
    const res = await restoreBackup(JSON.parse(fs.readFileSync(args[0], "utf8")), {
      dryRun: flags.has("--dry-run"),
      replace: flags.has("--replace"),
    });
    console.log(res.dryRun ? "Simulación correcta (no se ha escrito nada):" : "Restauración completada:", res.counts);
    if (res.preRestoreBackup) console.log(`Copia previa guardada en ${res.preRestoreBackup}`);
  } else if (cmd === "import" && args[0] === "plane") {
    await importPlane();
  } else {
    console.log("Uso: projectos backup [archivo] | restore <archivo> [--dry-run] [--replace] | import plane --workspace=<slug> [--dry-run]");
    process.exitCode = 1;
  }
  await (await getHandle()).close();
}

main().catch((e) => {
  console.error(`Error: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
