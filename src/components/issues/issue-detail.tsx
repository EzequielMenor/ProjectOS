"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronRight, ExternalLink, FileText, X } from "lucide-react";
import { PRIORITIES, type Priority, type StateGroup } from "@/db/schema";
import type { StateDTO } from "@/server/dto";
import {
  addCommentAction,
  addRelationAction,
  assignIssueAction,
  createIssueAction,
  createLabelAction,
  removeRelationAction,
  updateIssueAction,
} from "@/app/actions";
import { PRIORITY_LABEL, PriorityIcon, StateIcon } from "@/lib/issue-meta";
import { Markdown } from "@/components/markdown";
import { Textarea } from "@/components/ui/textarea";
import { OptionPicker } from "./option-picker";
import { LabelPicker, type LabelOption } from "./label-picker";
import { IssuePicker, type IssueOption } from "./issue-picker";

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
  projectId: string;
  labelIds: string[];
  dueDate: string | null;
  estimate: number | null;
  parent: { id: string; key: string; title: string } | null;
  children: { id: string; key: string; title: string; stateGroup: StateGroup; stateColor: string }[];
  relations: { type: string; id: string; key: string; title: string; stateGroup: StateGroup }[];
  projectIdentifier: string;
  projectName: string;
  createdAt: string;
  comments: { id: string; actor: string; body: string; createdAt: string }[];
  links: { id: string; kind: string; url: string; title: string }[];
};
type Named = { id: string; name: string };
type Planning = { cycles: Named[]; modules: Named[]; milestones: Named[] };
type Activity = { id: string; actor: string; action: string; createdAt: string; data: Record<string, unknown> };

const RELATION_LABEL: Record<string, string> = {
  blocks: "Bloquea a",
  blocked_by: "Bloqueado por",
  relates: "Relacionado con",
  duplicates: "Duplica a",
};
const RELATION_ORDER = ["blocked_by", "blocks", "relates", "duplicates"];

const fmt = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });

function describe(a: Activity): string {
  if (a.action === "issue.created") return "creó el issue";
  if (a.action === "comment.added") return "comentó";
  if (a.action === "link.added") return "añadió un enlace";
  if (a.action === "relation.added") return "añadió una relación";
  if (a.action === "relation.removed") return "quitó una relación";
  if (a.action === "issue.planned") return "cambió la planificación (ciclo, hito o módulos)";
  if (a.action === "issue.updated") {
    const ch = (a.data.changes ?? {}) as Record<string, { from: unknown; to: unknown }>;
    const parts = Object.entries(ch).map(([k, v]) => {
      const name = ({ stateId: "estado", priority: "prioridad", title: "título", description: "descripción", labels: "etiquetas", parentId: "padre", dueDate: "fecha límite", estimate: "estimación" } as Record<string, string>)[k] ?? k;
      return k === "description" || k === "title" || k === "labels" ? `cambió ${name}` : `cambió ${name}: ${String(v.from ?? "—")} → ${String(v.to ?? "—")}`;
    });
    return parts.join(", ") || "actualizó el issue";
  }
  return a.action;
}

/** Markdown when reading, plain textarea when editing; saves on blur. An empty description opens straight in the editor. */
function DescriptionField({ value, saved, onChange, onSave }: { value: string; saved: string; onChange: (v: string) => void; onSave: () => void }) {
  const [editing, setEditing] = useState(false);
  if (!editing && value.trim()) {
    return (
      <div className="group relative mt-4">
        <div
          onClick={(e) => !(e.target as HTMLElement).closest("a") && setEditing(true)}
          className="cursor-text rounded-md"
          data-testid="description-view"
        >
          <Markdown>{value}</Markdown>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="absolute -top-2 right-0 rounded border bg-background px-1.5 py-0.5 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        >
          Editar descripción
        </button>
      </div>
    );
  }
  return (
    <Textarea
      aria-label="Descripción"
      value={value}
      autoFocus={editing}
      onFocus={() => setEditing(true)}
      placeholder="Añade una descripción (Markdown)…"
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => {
        if (value !== saved) onSave();
        setEditing(false);
      }}
      className="mt-4 min-h-32 resize-y border-transparent bg-transparent px-0 shadow-none focus-visible:border-input focus-visible:px-3 dark:bg-transparent"
    />
  );
}

export function IssueDetail({
  issue,
  states,
  activity,
  planning,
  labels: initialLabels,
  candidates,
  mentions,
}: {
  issue: Detail;
  states: StateDTO[];
  activity: Activity[];
  planning: Planning;
  labels: LabelOption[];
  candidates: IssueOption[];
  mentions: { id: string; title: string; identifier: string }[];
}) {
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
  const [labels, setLabels] = useState(initialLabels);
  const [subtask, setSubtask] = useState("");
  const [relType, setRelType] = useState("blocked_by");

  const toggleLabel = (id: string) =>
    save({ labelIds: issue.labelIds.includes(id) ? issue.labelIds.filter((x) => x !== id) : [...issue.labelIds, id] });
  const createLabel = (name: string) =>
    start(async () => {
      const res = await createLabelAction({ projectId: issue.projectId, name });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setLabels((ls) => (ls.some((l) => l.id === res.data.id) ? ls : [...ls, res.data]));
      const r = await updateIssueAction(issue.id, { labelIds: [...issue.labelIds, res.data.id] });
      if (!r.ok) toast.error(r.error);
    });
  const addSubtask = () => {
    const title = subtask.trim();
    if (!title) return;
    start(async () => {
      const res = await createIssueAction({ projectId: issue.projectId, title, parentId: issue.id });
      if (res.ok) setSubtask("");
      else toast.error(res.error);
    });
  };
  const relate = (other: IssueOption) =>
    start(async () => {
      // "blocked by X" is stored as X blocks this issue
      const res =
        relType === "blocked_by"
          ? await addRelationAction(other.id, { relatedIssueId: issue.id, type: "blocks" })
          : await addRelationAction(issue.id, { relatedIssueId: other.id, type: relType });
      if (!res.ok) toast.error(res.error);
    });
  const unrelate = (r: Detail["relations"][number]) =>
    start(async () => {
      const res = await removeRelationAction(issue.id, { relatedIssueId: r.id, type: r.type === "blocked_by" ? "blocks" : r.type });
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
          <DescriptionField value={description} saved={issue.description} onChange={setDescription} onSave={() => save({ description })} />
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
          <section className="mt-8" aria-label="Subtareas">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Subtareas</h2>
            {issue.children.length ? (
              <ul className="mb-2 flex flex-col">
                {issue.children.map((c) => (
                  <li key={c.id}>
                    <Link href={`/${c.key.split("-")[0]}/issues/${c.key.split("-")[1]}`} className="flex h-8 items-center gap-2 rounded-md px-1.5 text-sm hover:bg-accent">
                      <StateIcon group={c.stateGroup} color={c.stateColor} />
                      <span className="font-mono text-xs text-muted-foreground">{c.key}</span>
                      <span className="truncate">{c.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            <input
              aria-label="Nueva subtarea"
              value={subtask}
              onChange={(e) => setSubtask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSubtask()}
              placeholder="Añadir subtarea (Enter)…"
              className="h-8 w-full rounded-md bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:bg-accent"
            />
          </section>
          <section className="mt-8" aria-label="Relaciones">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Relaciones</h2>
            {RELATION_ORDER.filter((t) => issue.relations.some((r) => r.type === t)).map((t) => (
              <div key={t} className="mb-2">
                <p className="mb-0.5 px-1.5 text-xs text-muted-foreground">{RELATION_LABEL[t]}</p>
                <ul>
                  {issue.relations
                    .filter((r) => r.type === t)
                    .map((r) => (
                      <li key={r.key} className="group flex h-8 items-center gap-2 rounded-md px-1.5 text-sm hover:bg-accent">
                        <StateIcon group={r.stateGroup} color="var(--muted-foreground)" />
                        <Link href={`/${r.key.split("-")[0]}/issues/${r.key.split("-")[1]}`} className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{r.key}</span>
                          <span className="truncate">{r.title}</span>
                        </Link>
                        <button aria-label={`Quitar relación con ${r.key}`} onClick={() => unrelate(r)} className="rounded p-0.5 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100">
                          <X className="size-3.5" />
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <select
                aria-label="Tipo de relación"
                value={relType}
                onChange={(e) => setRelType(e.target.value)}
                className="h-8 rounded-md border bg-background px-2 text-sm"
              >
                {RELATION_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {RELATION_LABEL[t]}
                  </option>
                ))}
              </select>
              <IssuePicker issues={candidates} onPick={relate} title="Añadir relación" className="h-8 border text-sm text-muted-foreground">
                Elegir issue…
              </IssuePicker>
            </div>
          </section>
          {mentions.length ? (
            <section className="mt-8" aria-label="Mencionado en">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Mencionado en</h2>
              <ul className="flex flex-col">
                {mentions.map((m) => (
                  <li key={m.id}>
                    <Link href={`/${m.identifier}/pages/${m.id}`} className="flex h-8 items-center gap-2 rounded-md px-1.5 text-sm hover:bg-accent">
                      <FileText className="size-3.5 text-muted-foreground" />
                      <span className="truncate">{m.title}</span>
                    </Link>
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
              <span className="text-muted-foreground">Estado</span>
              <span className="ml-auto flex items-center gap-1.5">
                <StateIcon group={state.group} color={state.color} />
                {state.name}
              </span>
            </OptionPicker>
            <OptionPicker
              title="Prioridad"
              value={issue.priority}
              onChange={(v) => save({ priority: v })}
              options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p], icon: <PriorityIcon priority={p} /> }))}
              className="w-full"
            >
              <span className="text-muted-foreground">Prioridad</span>
              <span className="ml-auto flex items-center gap-1.5">
                <PriorityIcon priority={issue.priority} />
                {PRIORITY_LABEL[issue.priority]}
              </span>
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
            <LabelPicker labels={labels} selected={issue.labelIds} onToggle={toggleLabel} onCreate={createLabel} className="w-full">
              <span className="text-muted-foreground">Etiquetas</span>
              <span className="ml-auto flex flex-wrap justify-end gap-1">
                {issue.labelIds.length
                  ? labels
                      .filter((l) => issue.labelIds.includes(l.id))
                      .map((l) => (
                        <span key={l.id} className="inline-flex items-center gap-1 rounded-full border px-1.5 text-xs">
                          <span className="size-1.5 rounded-full" style={{ background: l.color }} aria-hidden />
                          {l.name}
                        </span>
                      ))
                  : "—"}
              </span>
            </LabelPicker>
            <div className="flex items-center gap-1.5 px-1.5 py-1">
              <span className="text-muted-foreground">Padre</span>
              <span className="ml-auto min-w-0 truncate">
                {issue.parent ? (
                  <Link href={`/${issue.parent.key.split("-")[0]}/issues/${issue.parent.key.split("-")[1]}`} className="hover:underline" title={issue.parent.title}>
                    {issue.parent.key}
                  </Link>
                ) : (
                  <IssuePicker issues={candidates} onPick={(i) => save({ parentId: i.id })} title="Elegir padre" className="-mr-1.5 text-muted-foreground">
                    —
                  </IssuePicker>
                )}
              </span>
              {issue.parent ? (
                <button aria-label="Quitar padre" onClick={() => save({ parentId: null })} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
            <label className="flex items-center gap-1.5 px-1.5 py-1">
              <span className="text-muted-foreground">Fecha límite</span>
              <input
                type="date"
                aria-label="Fecha límite"
                defaultValue={issue.dueDate ?? ""}
                onChange={(e) => save({ dueDate: e.target.value || null })}
                className="ml-auto h-6 rounded bg-transparent text-right text-sm outline-none focus-visible:bg-accent"
              />
            </label>
            <label className="flex items-center gap-1.5 px-1.5 py-1">
              <span className="text-muted-foreground">Estimación</span>
              <input
                type="number"
                min={0}
                max={1000}
                aria-label="Estimación"
                defaultValue={issue.estimate ?? ""}
                onBlur={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  if (v !== issue.estimate) save({ estimate: v });
                }}
                className="ml-auto h-6 w-16 rounded bg-transparent text-right text-sm outline-none focus-visible:bg-accent"
              />
            </label>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">Creado {fmt.format(new Date(issue.createdAt))}</p>
        </aside>
      </div>
    </div>
  );
}
