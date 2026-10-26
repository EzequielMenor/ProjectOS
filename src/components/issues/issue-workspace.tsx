"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  pointerWithin,
  type CollisionDetection,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { LayoutList, Columns3, Plus, Table2, ArrowDown, ArrowUp } from "lucide-react";
import { PRIORITIES, type Priority } from "@/db/schema";
import type { IssueDTO, LabelDTO, StateDTO } from "@/server/dto";
import { applyFilters, parseFilters, serializeFilters, type Filters } from "@/lib/issue-filters";
import { FilterBar, type SavedViewDTO } from "./filter-bar";
import { createIssueAction, moveIssueAction, updateIssueAction } from "@/app/actions";
import { EpicBadge, PRIORITY_LABEL, PriorityIcon, StateIcon } from "@/lib/issue-meta";
import { cn } from "@/lib/utils";
import { OptionPicker } from "./option-picker";

type Project = { id: string; identifier: string; name: string };
type View = "list" | "board" | "table";
type Named = { id: string; name: string };

type Op =
  | { type: "add"; issue: IssueDTO }
  | { type: "patch"; id: string; patch: Partial<IssueDTO> }
  | { type: "move"; id: string; stateId: string; sortOrder: number };

function reduce(issues: IssueDTO[], op: Op): IssueDTO[] {
  switch (op.type) {
    case "add":
      return [op.issue, ...issues];
    case "patch":
      return issues.map((i) => (i.id === op.id ? { ...i, ...op.patch } : i));
    case "move":
      return issues.map((i) => (i.id === op.id ? { ...i, stateId: op.stateId, sortOrder: op.sortOrder } : i));
  }
}

const bySort = (a: IssueDTO, b: IssueDTO) => a.sortOrder - b.sortOrder;

export function IssueWorkspace({
  project,
  states,
  initialIssues,
  view,
  labels,
  cycles,
  modules,
  views,
}: {
  project: Project;
  states: StateDTO[];
  initialIssues: IssueDTO[];
  view: View;
  labels: LabelDTO[];
  cycles: Named[];
  modules: Named[];
  views: SavedViewDTO[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [issues, applyOp] = useOptimistic(initialIssues, reduce);
  const [selected, setSelected] = useState<string | null>(null);
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const [filters, setFiltersState] = useState<Filters>(() => parseFilters(searchParams));
  // Navigation (a saved view, back/forward) changes the URL: adopt it. Our own history.replaceState
  // produces a URL equal to the current filters, so it is a no-op.
  const urlQuery = searchParams.toString();
  const [seenUrl, setSeenUrl] = useState(urlQuery);
  if (urlQuery !== seenUrl) {
    setSeenUrl(urlQuery);
    const fromUrl = parseFilters(searchParams);
    if (serializeFilters(fromUrl) !== serializeFilters(filters)) setFiltersState(fromUrl);
  }
  const query = serializeFilters(filters);
  const setFilters = (f: Filters) => {
    setFiltersState(f);
    const qs = serializeFilters(f);
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  };
  const visible = useMemo(() => applyFilters(issues, filters), [issues, filters]);

  const columns = useMemo(
    () =>
      states.map((s) => ({
        state: s,
        issues: visible.filter((i) => i.stateId === s.id).sort(bySort),
      })),
    [states, visible],
  );
  const flat = useMemo(() => columns.flatMap((c) => c.issues), [columns]);
  const defaultStateId = states.find((s) => s.group === "unstarted")?.id ?? states[0]?.id;

  const mutate = useCallback(
    (op: Op, run: () => Promise<{ ok: boolean; error?: string }>) => {
      startTransition(async () => {
        applyOp(op);
        const res = await run();
        if (!res.ok) toast.error(res.error ?? "No se pudo guardar el cambio");
      });
    },
    [applyOp],
  );

  const createIssue = useCallback(
    (title: string, stateId: string) => {
      const minSort = flat.length ? Math.min(...flat.map((i) => i.sortOrder)) : 0;
      const temp: IssueDTO = {
        id: `tmp-${crypto.randomUUID()}`,
        key: `${project.identifier}-…`,
        seq: 0,
        title,
        type: "issue",
        stateId,
        priority: "none",
        parentId: null,
        assigneeId: null,
        estimate: null,
        dueDate: null,
        cycleId: null,
        milestoneId: null,
        moduleIds: [],
        sortOrder: minSort - 1000,
        labels: [],
        pending: true,
      };
      mutate({ type: "add", issue: temp }, () => createIssueAction({ projectId: project.id, title, stateId }));
    },
    [flat, mutate, project],
  );

  const setPriority = (id: string, priority: Priority) =>
    mutate({ type: "patch", id, patch: { priority } }, () => updateIssueAction(id, { priority }));
  const setState = (id: string, stateId: string) =>
    mutate({ type: "patch", id, patch: { stateId } }, () => updateIssueAction(id, { stateId }));

  // Keyboard: j/k move, Enter opens, c creates, l/b/t switch view.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable=true], [role=dialog], [role=listbox]") || e.metaKey || e.ctrlKey || e.altKey)
        return;
      const idx = flat.findIndex((i) => i.id === selected);
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelected(flat[Math.min(idx + 1, flat.length - 1)]?.id ?? null);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelected(flat[Math.max(idx - 1, 0)]?.id ?? null);
      } else if (e.key === "Enter" && selected) {
        const it = flat.find((i) => i.id === selected);
        if (it && !it.pending) router.push(`/${project.identifier}/issues/${it.seq}`);
      } else if (e.key === "c") {
        e.preventDefault();
        setCreatingIn(defaultStateId ?? null);
      } else if (e.key === "l") router.push(`/${project.identifier}/list`);
      else if (e.key === "b") router.push(`/${project.identifier}/board`);
      else if (e.key === "t") router.push(`/${project.identifier}/table`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flat, selected, router, project.identifier, defaultStateId]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <span className="size-2.5 rounded-sm" style={{ background: "var(--primary)" }} aria-hidden />
        <h1 className="min-w-0 truncate text-sm font-medium">{project.name}</h1>
        <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">{flat.length === issues.length ? `${flat.length} issues` : `${flat.length} de ${issues.length} issues`}</span>
        <nav className="ml-auto flex shrink-0 items-center gap-1 rounded-md border p-0.5" aria-label="Vista">
          <ViewLink href={`/${project.identifier}/list${query ? `?${query}` : ""}`} active={view === "list"} icon={<LayoutList className="size-3.5" />} label="Lista" />
          <ViewLink href={`/${project.identifier}/board${query ? `?${query}` : ""}`} active={view === "board"} icon={<Columns3 className="size-3.5" />} label="Kanban" />
          <ViewLink href={`/${project.identifier}/table${query ? `?${query}` : ""}`} active={view === "table"} icon={<Table2 className="size-3.5" />} label="Tabla" />
        </nav>
        <button
          onClick={() => setCreatingIn(defaultStateId ?? null)}
          aria-label="Nuevo issue"
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="size-3.5" /> <span className="hidden sm:inline">Nuevo issue</span> <kbd className="ml-1 hidden rounded bg-white/20 px-1 text-[0.75rem] sm:inline">C</kbd>
        </button>
      </header>
      <FilterBar filters={filters} onChange={setFilters} states={states} labels={labels} cycles={cycles} modules={modules} views={views} project={project} layout={view} />
      <div className="min-h-0 flex-1 overflow-auto">
        {view === "table" ? (
          <TableView issues={visible} total={issues.length} project={project} states={states} cycles={cycles} onPriority={setPriority} onState={setState} onClear={() => setFilters(parseFilters(new URLSearchParams()))} />
        ) : view === "list" ? (
          <ListView
            columns={columns}
            project={project}
            selected={selected}
            setSelected={setSelected}
            creatingIn={creatingIn}
            setCreatingIn={setCreatingIn}
            onCreate={createIssue}
            states={states}
            onPriority={setPriority}
            onState={setState}
          />
        ) : (
          <BoardView
            columns={columns}
            project={project}
            selected={selected}
            setSelected={setSelected}
            creatingIn={creatingIn}
            setCreatingIn={setCreatingIn}
            onCreate={createIssue}
            onMove={(id, stateId, prevId, nextId) => {
              const prev = flat.find((i) => i.id === prevId);
              const next = flat.find((i) => i.id === nextId);
              const sortOrder =
                prev && next ? (prev.sortOrder + next.sortOrder) / 2 : prev ? prev.sortOrder + 1000 : next ? next.sortOrder - 1000 : 0;
              mutate({ type: "move", id, stateId, sortOrder }, () => moveIssueAction(id, { stateId, prevId, nextId }));
            }}
          />
        )}
      </div>
    </div>
  );
}

type SortKey = "key" | "title" | "state" | "priority" | "due" | "estimate";
const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

type Sort = { key: SortKey; dir: 1 | -1 };

function Th({ k, sort, onSort, children, className }: { k?: SortKey; sort: Sort; onSort: (s: Sort) => void; children: React.ReactNode; className?: string }) {
  return (
    <th scope="col" aria-sort={k && sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : undefined} className={cn("h-8 px-3 text-left text-xs font-medium text-muted-foreground", className)}>
      {k ? (
        <button onClick={() => onSort(sort.key === k ? { key: k, dir: (-sort.dir) as 1 | -1 } : { key: k, dir: 1 })} className="inline-flex items-center gap-1 hover:text-foreground">
          {children}
          {sort.key === k ? sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

function TableView({
  issues, total, project, states, cycles, onPriority, onState, onClear,
}: {
  issues: IssueDTO[];
  total: number;
  project: Project;
  states: StateDTO[];
  cycles: Named[];
  onPriority: (id: string, p: Priority) => void;
  onState: (id: string, s: string) => void;
  onClear: () => void;
}) {
  const [sort, setSort] = useState<Sort>({ key: "key", dir: -1 });
  const stateById = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);
  const cycleName = useMemo(() => new Map(cycles.map((c) => [c.id, c.name])), [cycles]);
  const rows = useMemo(() => {
    const val = (i: IssueDTO): string | number => {
      switch (sort.key) {
        case "key": return i.seq;
        case "title": return i.title.toLowerCase();
        case "state": return stateById.get(i.stateId)?.position ?? 0;
        case "priority": return PRIORITY_RANK[i.priority];
        case "due": return i.dueDate ?? "9999";
        case "estimate": return i.estimate ?? -1;
      }
    };
    return [...issues].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * sort.dir);
  }, [issues, sort, stateById]);

  if (rows.length === 0)
    return (
      <div className="mx-auto flex h-full max-w-sm flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-base font-medium">{total ? "Ningún issue coincide con los filtros" : "Aún no hay issues"}</h2>
        {total ? (
          <button onClick={onClear} className="h-8 rounded-md border px-3 text-sm hover:bg-accent">Limpiar filtros</button>
        ) : (
          <p className="text-sm text-muted-foreground">Crea el primero desde la vista Lista o con el botón «Nuevo issue».</p>
        )}
      </div>
    );

  return (
    <table className="w-full min-w-[44rem] border-collapse text-sm" data-testid="issue-table">
      <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
        <tr className="border-b">
          <Th sort={sort} onSort={setSort} k="priority" className="w-10"><span className="sr-only">Prioridad</span></Th>
          <Th sort={sort} onSort={setSort} k="key" className="w-24">Clave</Th>
          <Th sort={sort} onSort={setSort} k="title">Título</Th>
          <Th sort={sort} onSort={setSort} k="state" className="w-36">Estado</Th>
          <Th sort={sort} onSort={setSort}>Etiquetas</Th>
          <Th sort={sort} onSort={setSort} className="w-32">Ciclo</Th>
          <Th sort={sort} onSort={setSort} k="due" className="w-28">Límite</Th>
          <Th sort={sort} onSort={setSort} k="estimate" className="w-16 text-right">Est.</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((i) => {
          const st = stateById.get(i.stateId)!;
          return (
            <tr key={i.id} data-testid="issue-row" className={cn("h-9 border-b hover:bg-accent/40", i.pending && "opacity-60")}>
              <td className="px-3">
                <OptionPicker
                  title="Prioridad"
                  value={i.priority}
                  onChange={(v) => onPriority(i.id, v as Priority)}
                  options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p], icon: <PriorityIcon priority={p} /> }))}
                >
                  <PriorityIcon priority={i.priority} />
                </OptionPicker>
              </td>
              <td className="px-3 font-mono text-xs text-muted-foreground tabular-nums"><span className="mr-1.5">{i.key}</span><EpicBadge type={i.type} /></td>
              <td className="max-w-0 px-3">
                {i.pending ? <span className="block truncate">{i.title}</span> : <Link href={`/${project.identifier}/issues/${i.seq}`} className="block truncate hover:underline">{i.title}</Link>}
              </td>
              <td className="px-3">
                <OptionPicker
                  title="Estado"
                  value={i.stateId}
                  onChange={(v) => onState(i.id, v)}
                  options={states.map((s) => ({ value: s.id, label: s.name, icon: <StateIcon group={s.group} color={s.color} /> }))}
                >
                  <StateIcon group={st.group} color={st.color} />
                  <span className="text-xs">{st.name}</span>
                </OptionPicker>
              </td>
              <td className="px-3">
                <span className="flex flex-wrap gap-1">
                  {i.labels.map((l) => (
                    <span key={l.id} className="inline-flex items-center gap-1 rounded-full border px-1.5 text-[0.8125rem]">
                      <span className="size-1.5 rounded-full" style={{ background: l.color }} />
                      {l.name}
                    </span>
                  ))}
                </span>
              </td>
              <td className="truncate px-3 text-xs text-muted-foreground">{i.cycleId ? cycleName.get(i.cycleId) ?? "—" : "—"}</td>
              <td className="px-3 text-xs tabular-nums text-muted-foreground">{i.dueDate ?? "—"}</td>
              <td className="px-3 text-right text-xs tabular-nums text-muted-foreground">{i.estimate ?? "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ViewLink({ href, active, icon, label }: { href: string; active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded px-2 text-xs transition-colors",
        active ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

type Column = { state: StateDTO; issues: IssueDTO[] };
type SharedViewProps = {
  columns: Column[];
  project: Project;
  selected: string | null;
  setSelected: (id: string | null) => void;
  creatingIn: string | null;
  setCreatingIn: (id: string | null) => void;
  onCreate: (title: string, stateId: string) => void;
};

function QuickCreate({ stateId, onCreate, onClose, className }: { stateId: string; onCreate: (t: string, s: string) => void; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <input
      ref={ref}
      aria-label="Título del nuevo issue"
      placeholder="Título del issue — Enter para crear, Esc para cancelar"
      className={cn("w-full rounded-md border bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring", className)}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "Enter" && e.currentTarget.value.trim()) {
          onCreate(e.currentTarget.value.trim(), stateId);
          e.currentTarget.value = "";
          onClose();
        }
      }}
      onBlur={onClose}
    />
  );
}

function ListView({
  columns, project, selected, setSelected, creatingIn, setCreatingIn, onCreate, states, onPriority, onState,
}: SharedViewProps & {
  states: StateDTO[];
  onPriority: (id: string, p: Priority) => void;
  onState: (id: string, s: string) => void;
}) {
  const total = columns.reduce((n, c) => n + c.issues.length, 0);
  if (total === 0 && !creatingIn) {
    return (
      <div className="mx-auto flex h-full max-w-sm flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-base font-medium">Aún no hay issues</h2>
        <p className="text-sm text-muted-foreground">Crea el primero para empezar a planificar. Pulsa <kbd className="rounded border px-1 text-xs">C</kbd> en cualquier momento.</p>
        <button onClick={() => setCreatingIn(states[1]?.id ?? states[0].id)} className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">Crear issue</button>
      </div>
    );
  }
  return (
    <div className="pb-24">
      {columns.map(({ state, issues }) => (
        <section key={state.id} aria-label={state.name}>
          <div className="sticky top-0 z-10 flex h-9 items-center gap-2 border-b bg-muted/60 px-4 backdrop-blur">
            <StateIcon group={state.group} color={state.color} />
            <h2 className="text-xs font-medium">{state.name}</h2>
            <span className="text-xs text-muted-foreground tabular-nums">{issues.length}</span>
            <button aria-label={`Añadir a ${state.name}`} onClick={() => setCreatingIn(state.id)} className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
              <Plus className="size-3.5" />
            </button>
          </div>
          {creatingIn === state.id ? (
            <div className="border-b px-4 py-2">
              <QuickCreate stateId={state.id} onCreate={onCreate} onClose={() => setCreatingIn(null)} />
            </div>
          ) : null}
          {issues.map((issue) => (
            <div
              key={issue.id}
              data-testid="issue-row"
              data-selected={selected === issue.id}
              onMouseEnter={() => setSelected(issue.id)}
              className={cn(
                "group flex h-9 items-center gap-2 border-b px-4 text-sm",
                selected === issue.id && "bg-accent/60",
                issue.pending && "opacity-60",
              )}
            >
              <OptionPicker
                title="Prioridad"
                value={issue.priority}
                onChange={(v) => onPriority(issue.id, v as Priority)}
                options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p], icon: <PriorityIcon priority={p} /> }))}
              >
                <PriorityIcon priority={issue.priority} />
              </OptionPicker>
              <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{issue.key}</span>
              <OptionPicker
                title="Estado"
                value={issue.stateId}
                onChange={(v) => onState(issue.id, v)}
                options={states.map((s) => ({ value: s.id, label: s.name, icon: <StateIcon group={s.group} color={s.color} /> }))}
              >
                <StateIcon group={state.group} color={state.color} />
              </OptionPicker>
              {issue.pending ? (
                <span className="min-w-0 flex-1 truncate">{issue.title}</span>
              ) : (
                <Link href={`/${project.identifier}/issues/${issue.seq}`} className="min-w-0 flex-1 truncate hover:underline">
                  {issue.title}
                </Link>
              )}
              <EpicBadge type={issue.type} />
              {issue.labels.map((l) => (
                <span key={l.id} className="hidden shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[0.8125rem] sm:inline-flex">
                  <span className="size-1.5 rounded-full" style={{ background: l.color }} />
                  {l.name}
                </span>
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/** The column under the pointer wins; closestCorners alone prefers tall neighbouring columns. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : closestCorners(args);
};

function BoardView({
  columns, project, selected, setSelected, creatingIn, setCreatingIn, onCreate, onMove,
}: SharedViewProps & { onMove: (id: string, stateId: string, prevId: string | null, nextId: string | null) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  // While dragging we render a local copy so cards visibly hop between columns.
  const [local, setLocal] = useState<Column[] | null>(null);
  const cols = local ?? columns;
  const active = columns.flatMap((c) => c.issues).find((i) => i.id === activeId) ?? null;

  const findCol = (id: string, from: Column[]) =>
    from.find((c) => c.state.id === id) ?? from.find((c) => c.issues.some((i) => i.id === id));

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setLocal(columns);
  };
  const onDragOver = (e: DragOverEvent) => {
    const { active: a, over } = e;
    // dragOver can fire before the render caused by onDragStart; fall back to the source columns.
    const base = local ?? columns;
    if (!over) return;
    const from = findCol(String(a.id), base);
    const to = findCol(String(over.id), base);
    if (!from || !to || from.state.id === to.state.id) return;
    const moving = from.issues.find((i) => i.id === a.id)!;
    const overIdx = to.issues.findIndex((i) => i.id === over.id);
    setLocal(
      base.map((c) => {
        if (c.state.id === from.state.id) return { ...c, issues: c.issues.filter((i) => i.id !== a.id) };
        if (c.state.id === to.state.id) {
          const next = [...c.issues];
          next.splice(overIdx < 0 ? next.length : overIdx, 0, { ...moving, stateId: c.state.id });
          return { ...c, issues: next };
        }
        return c;
      }),
    );
  };
  const onDragEnd = (e: DragEndEvent) => {
    const { active: a, over } = e;
    const cur = local ?? columns;
    setActiveId(null);
    setLocal(null);
    if (!over) return;
    const to = findCol(String(over.id), cur);
    if (!to) return;
    let list = to.issues;
    const overIdx = list.findIndex((i) => i.id === over.id);
    if (!list.some((i) => i.id === a.id)) {
      // dragOver never moved it into this column: insert it where it was dropped.
      const moving = columns.flatMap((c) => c.issues).find((i) => i.id === a.id);
      if (!moving) return;
      list = [...list];
      list.splice(overIdx < 0 ? list.length : overIdx, 0, moving);
    }
    const oldIdx = list.findIndex((i) => i.id === a.id);
    if (oldIdx >= 0 && overIdx >= 0 && oldIdx !== overIdx) {
      const arr = [...list];
      const [m] = arr.splice(oldIdx, 1);
      arr.splice(overIdx, 0, m);
      list = arr;
    }
    const idx = list.findIndex((i) => i.id === a.id);
    if (idx < 0) return;
    const original = columns.find((c) => c.state.id === to.state.id)?.issues ?? [];
    if (original.map((i) => i.id).join() === list.map((i) => i.id).join()) return;
    onMove(String(a.id), to.state.id, list[idx - 1]?.id ?? null, list[idx + 1]?.id ?? null);
  };

  return (
    <DndContext id="board-dnd" sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { setActiveId(null); setLocal(null); }}>
      <div className="flex h-full gap-3 overflow-x-auto p-4">
        {cols.map(({ state, issues }) => (
          <BoardColumn key={state.id} state={state} issues={issues} project={project} selected={selected} setSelected={setSelected} creating={creatingIn === state.id} onStartCreate={() => setCreatingIn(state.id)} onStopCreate={() => setCreatingIn(null)} onCreate={onCreate} />
        ))}
      </div>
      <DragOverlay>{active ? <Card issue={active} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

function BoardColumn({
  state, issues, project, selected, setSelected, creating, onStartCreate, onStopCreate, onCreate,
}: {
  state: StateDTO; issues: IssueDTO[]; project: Project; selected: string | null; setSelected: (id: string | null) => void;
  creating: boolean; onStartCreate: () => void; onStopCreate: () => void; onCreate: (t: string, s: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: state.id });
  return (
    <section aria-label={state.name} className={cn("flex w-72 shrink-0 flex-col rounded-lg bg-muted/40", isOver && "ring-1 ring-ring/50")}>
      <div className="flex h-9 items-center gap-2 px-3">
        <StateIcon group={state.group} color={state.color} />
        <h2 className="text-xs font-medium">{state.name}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{issues.length}</span>
        <button aria-label={`Añadir a ${state.name}`} onClick={onStartCreate} className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <Plus className="size-3.5" />
        </button>
      </div>
      <div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {creating ? <QuickCreate stateId={state.id} onCreate={onCreate} onClose={onStopCreate} /> : null}
        <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {issues.map((i) => (
            <SortableCard key={i.id} issue={i} project={project} selected={selected === i.id} onHover={() => setSelected(i.id)} />
          ))}
        </SortableContext>
        {issues.length === 0 && !creating ? <p className="px-2 py-6 text-center text-xs text-muted-foreground">Arrastra aquí o pulsa +</p> : null}
      </div>
    </section>
  );
}

function SortableCard({ issue, project, selected, onHover }: { issue: IssueDTO; project: Project; selected: boolean; onHover: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id, disabled: issue.pending });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onMouseEnter={onHover}
      className={cn(isDragging && "opacity-30")}
      {...attributes}
      {...listeners}
    >
      <Card issue={issue} href={issue.pending ? undefined : `/${project.identifier}/issues/${issue.seq}`} selected={selected} />
    </div>
  );
}

function Card({ issue, href, selected, overlay }: { issue: IssueDTO; href?: string; selected?: boolean; overlay?: boolean }) {
  const body = (
    <div
      data-testid="issue-card"
      className={cn(
        "rounded-md border bg-card p-2.5 text-sm shadow-xs transition-colors hover:border-ring/50",
        selected && "border-ring/60",
        overlay && "rotate-1 shadow-lg",
        issue.pending && "opacity-60",
      )}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="font-mono text-[0.8125rem] text-muted-foreground tabular-nums">{issue.key}</span>
        <EpicBadge type={issue.type} />
        <PriorityIcon priority={issue.priority} className="ml-auto" />
      </div>
      <p className="line-clamp-3 leading-snug">{issue.title}</p>
      {issue.labels.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {issue.labels.map((l) => (
            <span key={l.id} className="inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[0.75rem]">
              <span className="size-1.5 rounded-full" style={{ background: l.color }} />
              {l.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
  return href ? <Link href={href} draggable={false} className="block outline-none">{body}</Link> : body;
}
