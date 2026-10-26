/* ProjectOS maintenance CLI: `pnpm projectos backup [file]` / `pnpm projectos restore <file> [--dry-run] [--replace]`.
 * With the embedded PGlite database, stop the app first (one process may own the data dir);
 * with DATABASE_URL (Postgres) it can run alongside the app. */
import fs from "node:fs";
import path from "node:path";
import { getHandle } from "@/db/client";
import { createBackup, restoreBackup, saveBackupToDisk } from "@/server/services/backup";

const [cmd, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith("--")));
const args = rest.filter((a) => !a.startsWith("--"));

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
  } else {
    console.log("Uso: projectos backup [archivo] | projectos restore <archivo> [--dry-run] [--replace]");
    process.exitCode = 1;
  }
  await (await getHandle()).close();
}

main().catch((e) => {
  console.error(`Error: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
