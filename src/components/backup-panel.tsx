"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Counts = Record<string, number>;
const fmt = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });
const headers = { "x-projectos-confirm": "1", "content-type": "application/json" };

export function BackupPanel({ backups }: { backups: { name: string; size: number; mtime: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<Counts | null>(null);
  const [confirm, setConfirm] = useState("");

  async function post(query: string, body?: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/backup?${query}`, { method: "POST", headers, body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      return json;
    } finally {
      setBusy(false);
    }
  }
  const run = async (fn: () => Promise<void>) => {
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Error" });
    }
  };
  const summary = (c: Counts) => `${c.project ?? 0} proyectos, ${c.issue ?? 0} issues, ${c.comment ?? 0} comentarios`;

  return (
    <div className="mt-6 flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Crear copia</h2>
        <div className="flex gap-2">
          <a href="/api/backup" download className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
            Descargar copia
          </a>
          <button
            disabled={busy}
            onClick={() => run(async () => { const r = await post("action=save"); setMsg({ ok: true, text: `Guardada en ${r.file}` }); router.refresh(); })}
            className="h-8 rounded-md border px-3 text-sm hover:bg-accent disabled:opacity-50"
          >
            Guardar en el servidor
          </button>
        </div>
        {backups.length ? (
          <ul className="text-xs text-muted-foreground">
            {backups.slice(0, 8).map((b) => (
              <li key={b.name} className="flex gap-2 py-0.5"><span className="font-mono">{b.name}</span><span className="ml-auto">{fmt.format(new Date(b.mtime))} · {(b.size / 1024).toFixed(0)} KB</span></li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Restaurar</h2>
        <p className="text-xs text-muted-foreground">Primero se simula y se muestra qué contiene. Si ya hay datos, se guarda automáticamente una copia previa antes de reemplazarlos.</p>
        <input
          type="file"
          accept="application/json,.json"
          aria-label="Archivo de copia"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setPreview(null);
            setConfirm("");
            if (!f) return setFile(null);
            f.text().then((text) => setFile({ name: f.name, text }));
          }}
          className="text-sm"
        />
        <button
          disabled={!file || busy}
          onClick={() => run(async () => { const r = await post("mode=dry&replace=1", file!.text); setPreview(r.counts); })}
          className="h-8 self-start rounded-md border px-3 text-sm hover:bg-accent disabled:opacity-50"
        >
          Simular
        </button>
        {preview ? (
          <div className="flex flex-col gap-2 text-sm">
            <p role="status">La copia contiene {summary(preview)}.</p>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Escribe RESTAURAR para reemplazar los datos actuales
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Confirmación" className="h-8 rounded-lg border bg-transparent px-2 text-sm text-foreground" />
            </label>
            <button
              disabled={confirm !== "RESTAURAR" || busy}
              onClick={() => run(async () => { const r = await post("replace=1", file!.text); setMsg({ ok: true, text: `Restaurado: ${summary(r.counts)}.${r.preRestoreBackup ? ` Copia previa en ${r.preRestoreBackup}` : ""}` }); setPreview(null); setConfirm(""); router.refresh(); })}
              className="h-8 self-start rounded-md bg-destructive px-3 text-sm font-medium text-white disabled:opacity-50"
            >
              Restaurar
            </button>
          </div>
        ) : null}
      </section>
      {msg ? <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm" : "text-sm text-destructive"}>{msg.text}</p> : null}
    </div>
  );
}
