"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createStateAction,
  deleteStateAction,
  moveStateAction,
  setDefaultStateAction,
  updateProjectAction,
  updateStateAction,
  type ActionResult,
} from "@/app/actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StateGroup } from "@/db/schema";

type Project = { id: string; identifier: string; name: string; description: string; color: string };
type StateRow = { id: string; name: string; group: StateGroup; color: string; isDefault: boolean; issues: number };

const GROUPS: { value: StateGroup; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "unstarted", label: "Sin empezar" },
  { value: "started", label: "En curso" },
  { value: "completed", label: "Completado" },
  { value: "cancelled", label: "Cancelado" },
];

const selectClass = "h-8 rounded-md border bg-background px-2 text-sm";
const primaryBtn = "h-8 shrink-0 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50";

export function ProjectSettings({ project, states }: { project: Project; states: StateRow[] }) {
  const [, start] = useTransition();
  const run = (fn: () => Promise<ActionResult<unknown>>, ok?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
      else if (ok) toast.success(ok);
    });

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-6 py-8">
      <h1 className="text-lg font-semibold tracking-tight">Ajustes de {project.name}</h1>
      <General project={project} run={run} />
      <States projectId={project.id} states={states} run={run} />
    </div>
  );
}

type Run = (fn: () => Promise<ActionResult<unknown>>, ok?: string) => void;

function General({ project, run }: { project: Project; run: Run }) {
  const [name, setName] = useState(project.name);
  const [color, setColor] = useState(project.color);
  const [description, setDescription] = useState(project.description);
  const dirty = name !== project.name || color !== project.color || description !== project.description;
  return (
    <form
      aria-label="General"
      className="mt-6 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateProjectAction(project.id, { name, color, description }), "Proyecto guardado");
      }}
    >
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">General</h2>
      <div className="flex items-center gap-2">
        <input type="color" aria-label="Color del proyecto" value={color} onChange={(e) => setColor(e.target.value)} className="size-8 shrink-0 cursor-pointer rounded border bg-transparent p-0.5" />
        <Input aria-label="Nombre del proyecto" value={name} onChange={(e) => setName(e.target.value)} required />
        <span className="shrink-0 font-mono text-xs text-muted-foreground" title="El identificador no se puede cambiar: forma parte de las claves de los issues">{project.identifier}</span>
      </div>
      <Textarea aria-label="Descripción del proyecto" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción del proyecto (Markdown)…" className="min-h-24" />
      <div>
        <button disabled={!dirty || !name.trim()} className={primaryBtn}>
          Guardar
        </button>
      </div>
    </form>
  );
}

function States({ projectId, states, run }: { projectId: string; states: StateRow[]; run: Run }) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState<StateGroup>("started");
  const [color, setColor] = useState("#8b5cf6");
  return (
    <section aria-label="Estados" className="mt-10">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estados</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        El flujo del proyecto, en orden. El grupo decide cómo cuenta cada estado en el progreso y en el cierre de issues.
      </p>
      <ul className="mt-3 divide-y rounded-lg border">
        {states.map((s, i) => (
          <StateItem key={`${s.id}:${s.name}:${s.color}:${s.group}`} s={s} states={states} first={i === 0} last={i === states.length - 1} run={run} />
        ))}
      </ul>
      <form
        aria-label="Nuevo estado"
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const res = await createStateAction({ projectId, name, group, color });
            if (res.ok) setName("");
            return res;
          });
        }}
      >
        <input type="color" aria-label="Color del nuevo estado" value={color} onChange={(e) => setColor(e.target.value)} className="size-8 shrink-0 cursor-pointer rounded border bg-transparent p-0.5" />
        <Input aria-label="Nombre del nuevo estado" placeholder="Nuevo estado" value={name} onChange={(e) => setName(e.target.value)} required />
        <select aria-label="Grupo del nuevo estado" value={group} onChange={(e) => setGroup(e.target.value as StateGroup)} className={selectClass}>
          {GROUPS.map((g) => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </select>
        <button disabled={!name.trim()} className={primaryBtn}>Añadir</button>
      </form>
    </section>
  );
}

function StateItem({ s, states, first, last, run }: { s: StateRow; states: StateRow[]; first: boolean; last: boolean; run: Run }) {
  const [name, setName] = useState(s.name);
  const [confirming, setConfirming] = useState(false);
  const [target, setTarget] = useState("");
  const others = states.filter((o) => o.id !== s.id);
  const patch = (p: Record<string, unknown>) => run(() => updateStateAction(s.id, p));
  return (
    <li data-testid="state-row" className="flex flex-col gap-2 px-3 py-2">
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`Color de ${s.name}`} value={s.color} onChange={(e) => patch({ color: e.target.value })} className="size-7 shrink-0 cursor-pointer rounded border bg-transparent p-0.5" />
        <Input
          aria-label={`Nombre de ${s.name}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name !== s.name) patch({ name });
            else setName(s.name);
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="h-7"
        />
        <select aria-label={`Grupo de ${s.name}`} value={s.group} onChange={(e) => patch({ group: e.target.value })} className={`${selectClass} h-7`}>
          {GROUPS.map((g) => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </select>
        <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{s.issues} {s.issues === 1 ? "issue" : "issues"}</span>
        <label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <input type="radio" name="default-state" checked={s.isDefault} onChange={() => run(() => setDefaultStateAction(s.id))} aria-label={`${s.name} por defecto`} />
          Por defecto
        </label>
        <button type="button" aria-label={`Subir ${s.name}`} disabled={first} onClick={() => run(() => moveStateAction(s.id, "up"))} className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30">
          <ArrowUp className="size-3.5" />
        </button>
        <button type="button" aria-label={`Bajar ${s.name}`} disabled={last} onClick={() => run(() => moveStateAction(s.id, "down"))} className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30">
          <ArrowDown className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={`Borrar ${s.name}`}
          disabled={s.isDefault}
          title={s.isDefault ? "Elige otro estado por defecto para poder borrarlo" : undefined}
          onClick={() => {
            setConfirming((v) => !v);
            setTarget(others.find((o) => o.group === s.group)?.id ?? others[0]?.id ?? "");
          }}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-30"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {confirming ? (
        <div role="group" aria-label={`Borrar ${s.name}`} className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-sm">
          <span>{s.issues ? `Mover sus ${s.issues} issues a` : "Se borrará. Destino de sus issues, si los hubiera:"}</span>
          <select aria-label="Estado de destino" value={target} onChange={(e) => setTarget(e.target.value)} className={`${selectClass} h-7`}>
            {others.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <button type="button" disabled={!target} onClick={() => run(async () => {
            const res = await deleteStateAction(s.id, { moveIssuesTo: target });
            if (res.ok) setConfirming(false);
            return res;
          })} className="h-7 rounded-md bg-destructive px-2.5 text-xs font-medium text-white disabled:opacity-50">
            Mover y borrar
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="h-7 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent">Cancelar</button>
        </div>
      ) : null}
    </li>
  );
}
