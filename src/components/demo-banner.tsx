"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Cloud, Download, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { resetDemoAction } from "@/app/actions";

export function DemoBanner() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div
      role="region"
      aria-label="Modo demostración"
      className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-indigo-500/25 bg-indigo-500/10 px-3 py-1.5 text-xs text-foreground"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-white uppercase">
          <Sparkles className="size-3" />
          Demo en vivo
        </span>
        <span className=" truncate text-muted-foreground sm:inline">
          Prueba libremente con datos de ejemplo: mueve tarjetas en el Kanban, abre issues con commits de agentes o pulsa{" "}
          <kbd className="rounded border bg-background px-1 py-0.5 font-mono text-[0.6875rem] text-foreground">Ctrl K</kbd>.
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await resetDemoAction();
              if (res.ok) {
                toast.success("Datos de prueba reiniciados al estado original");
                router.refresh();
              } else {
                toast.error(res.error);
              }
            })
          }
          className="inline-flex h-6 items-center gap-1 rounded-md border bg-background/80 px-2 font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          <RotateCcw className={`size-3 ${pending ? "animate-spin" : ""}`} />
          <span>{pending ? "Reiniciando…" : "Reiniciar datos"}</span>
        </button>

        <Link
          href="/welcome#instalar"
          className="inline-flex h-6 items-center gap-1 rounded-md border bg-background/80 px-2 font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Download className="size-3" />
          <span>Cómo instalar gratis</span>
        </Link>

        <Link
          href="/welcome#precios"
          className="inline-flex h-6 items-center gap-1 rounded-md bg-indigo-600 px-2.5 font-medium text-white transition-colors hover:bg-indigo-500"
        >
          <Cloud className="size-3" />
          <span>ProjectOS Cloud</span>
        </Link>
      </div>
    </div>
  );
}
