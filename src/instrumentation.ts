/** Runs once when the server starts: keeps a rolling daily backup of the database (set AUTO_BACKUP=off to disable). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.AUTO_BACKUP === "off") return;
  const { runAutoBackup } = await import("@/server/services/auto-backup");
  const tick = () =>
    runAutoBackup()
      .then((r) => "saved" in r && console.log(`[projectos] copia automática: ${r.saved}`))
      .catch((e) => console.error("[projectos] copia automática fallida:", e));
  // not on the startup path: the server must answer first
  setTimeout(tick, 15_000).unref();
  setInterval(tick, 3_600_000).unref();
}
