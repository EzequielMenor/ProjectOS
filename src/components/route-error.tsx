"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

/** Shared fallback for route errors. `retry` re-fetches and re-renders the failed segment. */
export function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  return (
    <div role="alert" className="grid h-full place-items-center p-6">
      <div className="max-w-md text-center">
        <AlertTriangle className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden />
        <h1 className="text-lg font-semibold">Algo ha fallado</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          No se ha podido cargar esta pantalla. Tus datos no se han tocado; vuelve a intentarlo o regresa al inicio.
        </p>
        {digest ? <p className="mt-2 font-mono text-xs text-muted-foreground">ref: {digest}</p> : null}
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" onClick={() => retry()} className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Reintentar
          </button>
          <Link href="/" className="grid h-8 place-items-center rounded-md border px-3 text-sm hover:bg-accent">
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
