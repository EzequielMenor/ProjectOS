"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPlanningAction } from "@/app/actions";
import { Input } from "@/components/ui/input";
import type { Progress } from "@/server/services/planning";
import { ProgressBar } from "./progress-bar";

export type PlanItem = { id: string; name: string; description: string; from: string | null; to: string | null; status?: string; progress: Progress };
type Kind = "cycle" | "module" | "milestone";

const COPY: Record<Kind, { title: string; empty: string; toLabel: string; fromLabel?: string; add: string }> = {
  cycle: { title: "Ciclos", empty: "Aún no hay ciclos. Un ciclo es un sprint con fechas de inicio y fin.", fromLabel: "Inicio", toLabel: "Fin", add: "Crear ciclo" },
  module: { title: "Módulos", empty: "Aún no hay módulos. Agrupa el trabajo por funcionalidad o fase.", fromLabel: "Inicio", toLabel: "Objetivo", add: "Crear módulo" },
  milestone: { title: "Hitos", empty: "Aún no hay hitos. Un hito es una meta con fecha en el roadmap.", toLabel: "Fecha objetivo", add: "Crear hito" },
};

const STATUS_LABEL: Record<string, string> = { backlog: "Backlog", planned: "Planificado", in_progress: "En curso", paused: "En pausa", completed: "Completado", cancelled: "Cancelado" };
const fmt = (d: string | null) => (d ? new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(new Date(`${d}T00:00:00`)) : null);

export function PlanningList({ kind, projectId, items }: { kind: Kind; projectId: string; items: PlanItem[] }) {
  const router = useRouter();
  const copy = COPY[kind];
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const dates = kind === "cycle" ? { startDate: from || null, endDate: to || null } : kind === "module" ? { startDate: from || null, targetDate: to || null } : { targetDate: to || null };
    start(async () => {
      const res = await createPlanningAction(kind, { projectId, name, ...dates });
      if (res.ok) {
        setName("");
        setFrom("");
        setTo("");
        router.refresh();
      } else setError(res.error);
    });
  };

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-6 py-8">
      <h1 className="text-lg font-semibold tracking-tight">{copy.title}</h1>
      <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-2">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Nombre
          <Input aria-label={`Nombre de ${copy.title.toLowerCase()}`} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        {copy.fromLabel ? (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {copy.fromLabel}
            <Input type="date" aria-label={copy.fromLabel} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {copy.toLabel}
          <Input type="date" aria-label={copy.toLabel} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button disabled={pending || !name.trim()} className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {copy.add}
        </button>
      </form>
      {error ? <p role="alert" className="mt-2 text-sm text-destructive">{error}</p> : null}

      {items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">{copy.empty}</p>
      ) : (
        <ul className="mt-6 divide-y rounded-lg border">
          {items.map((it) => (
            <li key={it.id} data-testid="plan-item" className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{it.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[it.status ? STATUS_LABEL[it.status] : null, fmt(it.from) && fmt(it.to) ? `${fmt(it.from)} → ${fmt(it.to)}` : fmt(it.to) ?? fmt(it.from)].filter(Boolean).join(" · ") || "Sin fechas"}
                </p>
              </div>
              <ProgressBar progress={it.progress} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
