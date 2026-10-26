import { BackupPanel } from "@/components/backup-panel";
import { listBackups } from "@/server/services/backup";

export const metadata = { title: "Copias de seguridad" };
export const dynamic = "force-dynamic";

export default function BackupPage() {
  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto px-6 py-10">
      <h1 className="text-lg font-semibold tracking-tight">Copias de seguridad</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Exporta todo el workspace a un archivo JSON y restáuralo cuando quieras. Los tokens de API no van en la copia y se conservan al restaurar.
      </p>
      <BackupPanel backups={listBackups().map((b) => ({ name: b.name, size: b.size, mtime: b.mtime.toISOString() }))} />
    </div>
  );
}
