"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { createIssueAction } from "@/app/actions";
import { ProgressBar } from "@/components/planning/progress-bar";
import { Input } from "@/components/ui/input";
import { StateIcon } from "@/lib/issue-meta";
import type { EpicRow } from "@/server/services/epics";

type Epic = EpicRow & { seq: number };

export function EpicList({ projectId, identifier, epics }: { projectId: string; identifier: string; epics: Epic[] }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-6 py-8">
      <h1 className="text-lg font-semibold tracking-tight">Épicas</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Una épica agrupa issues grandes: su progreso sale de sus subtareas. Convierte cualquier issue en épica desde su ficha (Tipo).
      </p>
      <form
        className="mt-4 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const res = await createIssueAction({ projectId, title, type: "epic" });
            if (res.ok) setTitle("");
            else setError(res.error);
          });
        }}
      >
        <Input aria-label="Título de la nueva épica" placeholder="Título de la nueva épica" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <button disabled={pending || !title.trim()} className="h-8 shrink-0 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
          Crear épica
        </button>
      </form>
      {error ? <p role="alert" className="mt-2 text-sm text-destructive">{error}</p> : null}

      {epics.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aún no hay épicas. Crea la primera, o abre un issue con subtareas (p. ej. una versión o un hito grande) y márcalo como épica.
        </p>
      ) : (
        <ul className="mt-6 divide-y rounded-lg border">
          {epics.map((e) => (
            <li key={e.id} data-testid="epic-row">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 hover:bg-accent [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
                  <StateIcon group={e.state.group} color={e.state.color} />
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{e.key}</span>
                  <Link href={`/${identifier}/issues/${e.seq}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                    {e.title}
                  </Link>
                  {e.progress.total ? <ProgressBar progress={e.progress} /> : <span className="shrink-0 text-xs text-muted-foreground">Sin subtareas</span>}
                </summary>
                {e.children.length ? (
                  <ul className="border-t bg-muted/30 py-1 pl-10 pr-3">
                    {e.children.map((c) => (
                      <li key={c.id}>
                        <Link href={`/${identifier}/issues/${c.key.split("-").pop()}`} className="flex h-8 items-center gap-2 rounded-md px-1.5 text-sm hover:bg-accent">
                          <StateIcon group={c.stateGroup} color={c.stateColor} />
                          <span className="font-mono text-xs text-muted-foreground">{c.key}</span>
                          <span className="truncate">{c.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="border-t bg-muted/30 px-10 py-2 text-sm text-muted-foreground">Abre la épica para añadir su primera subtarea.</p>
                )}
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
