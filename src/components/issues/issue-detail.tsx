"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronRight, ExternalLink } from "lucide-react";
import { PRIORITIES, type Priority } from "@/db/schema";
import type { StateDTO } from "@/server/dto";
import { addCommentAction, assignIssueAction, updateIssueAction } from "@/app/actions";
import { PRIORITY_LABEL, PriorityIcon, StateIcon } from "@/lib/issue-meta";
import { Textarea } from "@/components/ui/textarea";
import { OptionPicker } from "./option-picker";

type Detail = {
  id: string;
  key: string;
  title: string;
  description: string;
  stateId: string;
  priority: Priority;
  cycleId: string | null;
  milestoneId: string | null;
  moduleIds: string[];
  projectIdentifier: string;
  projectName: string;
  createdAt: string;
  comments: { id: string; actor: string; body: string; createdAt: string }[];
  links: { id: string; kind: string; url: string; title: string }[];
};
type Named = { id: string; name: string };
type Planning = { cycles: Named[]; modules: Named[]; milestones: Named[] };
type Activity = { id: string; actor: string; action: string; createdAt: string; data: Record<string, unknown> };

const fmt = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });

function describe(a: Activity): string {
  if (a.action === "issue.created") return "creó el issue";
  if (a.action === "comment.added") return "comentó";
  if (a.action === "link.added") return "añadió un enlace";
  if (a.action === "issue.planned") return "cambió la planificación (ciclo, hito o módulos)";
  if (a.action === "issue.updated") {
    const ch = (a.data.changes ?? {}) as Record<string, { from: unknown; to: unknown }>;
    const parts = Object.entries(ch).map(([k, v]) => {
      const name = ({ stateId: "estado", priority: "prioridad", title: "título", description: "descripción" } as Record<string, string>)[k] ?? k;
      return k === "description" || k === "title" || k === "labels" ? `cambió ${name}` : `cambió ${name}: ${String(v.from ?? "—")} → ${String(v.to ?? "—")}`;
    });
    return parts.join(", ") || "actualizó el issue";
  }
  return a.action;
}

export function IssueDetail({ issue, states, activity, planning }: { issue: Detail; states: StateDTO[]; activity: Activity[]; planning: Planning }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description);
  const [comment, setComment] = useState("");
  const state = states.find((s) => s.id === issue.stateId)!;

  const save = (patch: Record<string, unknown>) =>
    start(async () => {
      const res = await updateIssueAction(issue.id, patch);
      if (!res.ok) toast.error(res.error);
    });

  const assign = (patch: Record<string, unknown>) =>
    start(async () => {
      const res = await assignIssueAction(issue.id, patch);
      if (!res.ok) toast.error(res.error);
    });
  const NONE = "__none";
  const single = (list: Named[]) => [{ value: NONE, label: "Ninguno" }, ...list.map((x) => ({ value: x.id, label: x.name }))];
  const nameOf = (list: Named[], id: string | null, empty: string) => list.find((x) => x.id === id)?.name ?? empty;

  const timeline = [
    ...activity.filter((a) => a.action !== "comment.added").map((a) => ({ t: a.createdAt, kind: "activity" as const, a })),
    ...issue.comments.map((c) => ({ t: c.createdAt, kind: "comment" as const, c })),
  ].sort((x, y) => x.t.localeCompare(y.t));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-1.5 border-b px-4 text-sm">
        <Link href={`/${issue.projectIdentifier}/list`} className="text-muted-foreground hover:text-foreground">{issue.projectName}</Link>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <span className="font-mono text-xs">{issue.key}</span>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[1fr_16rem] lg:overflow-hidden">
        <article className="mx-auto w-full max-w-3xl px-6 py-8 lg:overflow-y-auto">
          <input
            aria-label="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== issue.title && save({ title: title.trim() })}
            className="w-full bg-transparent text-xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground"
          />
          <Textarea
            aria-label="Descripción"
            value={description}
            placeholder="Añade una descripción (Markdown)…"
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== issue.description && save({ description })}
            className="mt-4 min-h-32 resize-y border-transparent bg-transparent px-0 shadow-none focus-visible:border-input focus-visible:px-3"
          />
          {issue.links.length ? (
            <section className="mt-6">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Enlaces</h2>
              <ul className="flex flex-col gap-1">
                {issue.links.map((l) => (
                  <li key={l.id}>
                    <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm hover:underline">
                      <ExternalLink className="size-3.5 text-muted-foreground" />
                      <span className="rounded border px-1 text-[10px] uppercase text-muted-foreground">{l.kind}</span>
                      {l.title || l.url}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section className="mt-8" aria-label="Actividad">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Actividad</h2>
            <ol className="flex flex-col gap-3">
              {timeline.map((item) =>
                item.kind === "activity" ? (
                  <li key={item.a.id} className="flex items-baseline gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{item.a.actor}</span> {describe(item.a)}
                    <time className="ml-auto shrink-0 tabular-nums">{fmt.format(new Date(item.t))}</time>
                  </li>
                ) : (
                  <li key={item.c.id} className="rounded-lg border bg-card p-3 text-sm">
                    <div className="mb-1 flex items-baseline gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{item.c.actor}</span>
                      <time className="tabular-nums">{fmt.format(new Date(item.t))}</time>
                    </div>
                    <p className="whitespace-pre-wrap">{item.c.body}</p>
                  </li>
                ),
              )}
            </ol>
            <form
              className="mt-4 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const body = comment.trim();
                if (!body) return;
                start(async () => {
                  const res = await addCommentAction(issue.id, { body });
                  if (res.ok) {
                    setComment("");
                    router.refresh();
                  } else toast.error(res.error);
                });
              }}
            >
              <Textarea
                aria-label="Nuevo comentario"
                placeholder="Escribe un comentario…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
                }}
              />
              <button disabled={!comment.trim()} className="h-8 self-end rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
                Comentar
              </button>
            </form>
          </section>
        </article>
        <aside className="border-t p-4 lg:overflow-y-auto lg:border-l lg:border-t-0" aria-label="Propiedades">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Propiedades</h2>
          <div className="flex flex-col gap-1 text-sm">
            <OptionPicker
              title="Estado"
              value={issue.stateId}
              onChange={(v) => save({ stateId: v })}
              options={states.map((s) => ({ value: s.id, label: s.name, icon: <StateIcon group={s.group} color={s.color} /> }))}
              className="w-full"
            >
              <StateIcon group={state.group} color={state.color} />
              {state.name}
            </OptionPicker>
            <OptionPicker
              title="Prioridad"
              value={issue.priority}
              onChange={(v) => save({ priority: v })}
              options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p], icon: <PriorityIcon priority={p} /> }))}
              className="w-full"
            >
              <PriorityIcon priority={issue.priority} />
              {PRIORITY_LABEL[issue.priority]}
            </OptionPicker>
            <OptionPicker
              title="Ciclo"
              value={issue.cycleId ?? NONE}
              onChange={(v) => assign({ cycleId: v === NONE ? null : v })}
              options={single(planning.cycles)}
              className="w-full"
            >
              <span className="text-muted-foreground">Ciclo</span>
              <span className="ml-auto truncate">{nameOf(planning.cycles, issue.cycleId, "—")}</span>
            </OptionPicker>
            <OptionPicker
              title="Hito"
              value={issue.milestoneId ?? NONE}
              onChange={(v) => assign({ milestoneId: v === NONE ? null : v })}
              options={single(planning.milestones)}
              className="w-full"
            >
              <span className="text-muted-foreground">Hito</span>
              <span className="ml-auto truncate">{nameOf(planning.milestones, issue.milestoneId, "—")}</span>
            </OptionPicker>
            <OptionPicker
              title="Módulos"
              value=""
              onChange={(v) => assign({ moduleIds: issue.moduleIds.includes(v) ? issue.moduleIds.filter((x) => x !== v) : [...issue.moduleIds, v] })}
              options={planning.modules.map((m) => ({ value: m.id, label: `${issue.moduleIds.includes(m.id) ? "✓ " : ""}${m.name}` }))}
              className="w-full"
            >
              <span className="text-muted-foreground">Módulos</span>
              <span className="ml-auto truncate">{issue.moduleIds.length ? planning.modules.filter((m) => issue.moduleIds.includes(m.id)).map((m) => m.name).join(", ") : "—"}</span>
            </OptionPicker>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">Creado {fmt.format(new Date(issue.createdAt))}</p>
        </aside>
      </div>
    </div>
  );
}
