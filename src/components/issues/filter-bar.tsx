"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Bookmark, Check, ChevronDown, Filter, Search, X } from "lucide-react";
import { PRIORITIES, type Priority, type ViewLayout } from "@/db/schema";
import { createViewAction, deleteViewAction } from "@/app/actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { PRIORITY_LABEL, PriorityIcon, StateIcon } from "@/lib/issue-meta";
import { activeCount, EMPTY_FILTERS, serializeFilters, type Filters } from "@/lib/issue-filters";
import { NO_ASSIGNEE } from "@/lib/issue-filters";
import { MemberAvatar } from "@/components/member-avatar";
import type { LabelDTO, MemberDTO, PropertyDTO, StateDTO } from "@/server/dto";
import { cn } from "@/lib/utils";

type Named = { id: string; name: string };
export type SavedViewDTO = { id: string; name: string; layout: ViewLayout; query: string };

export function FilterBar({
  filters,
  onChange,
  states,
  labels,
  cycles,
  modules,
  members,
  properties,
  views,
  project,
  layout,
}: {
  properties: PropertyDTO[];
  members: MemberDTO[];
  filters: Filters;
  onChange: (f: Filters) => void;
  states: StateDTO[];
  labels: LabelDTO[];
  cycles: Named[];
  modules: Named[];
  views: SavedViewDTO[];
  project: { id: string; identifier: string };
  layout: ViewLayout;
}) {
  const n = activeCount(filters);
  const toggle = <K extends "state" | "assignee" | "priority" | "label" | "cycle" | "module">(key: K, value: Filters[K][number]) => {
    const cur = filters[key] as string[];
    onChange({ ...filters, [key]: cur.includes(value as string) ? cur.filter((x) => x !== value) : [...cur, value] });
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-1.5 text-xs" role="toolbar" aria-label="Filtros">
      <Filter className="size-3.5 text-muted-foreground" aria-hidden />
      <label className="relative">
        <Search className="pointer-events-none absolute left-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          aria-label="Filtrar por texto"
          placeholder="Filtrar…"
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          className="h-6 w-36 rounded-md border bg-transparent pl-6 pr-1.5 outline-none placeholder:text-muted-foreground focus-visible:border-ring"
        />
      </label>
      <MultiFilter
        title="Estado"
        selected={filters.state}
        onToggle={(v) => toggle("state", v)}
        options={states.map((s) => ({ value: s.id, label: s.name, icon: <StateIcon group={s.group} color={s.color} /> }))}
      />
      <MultiFilter
        title="Asignado"
        selected={filters.assignee}
        onToggle={(v) => toggle("assignee", v)}
        options={[
          { value: NO_ASSIGNEE, label: "Sin asignar" },
          ...members.map((m) => ({ value: m.id, label: m.name, icon: <MemberAvatar member={m} decorative className="size-4 text-[0.625rem]" /> })),
        ]}
      />
      <MultiFilter
        title="Prioridad"
        selected={filters.priority}
        onToggle={(v) => toggle("priority", v as Priority)}
        options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p], icon: <PriorityIcon priority={p} /> }))}
      />
      {labels.length ? (
        <MultiFilter
          title="Etiqueta"
          selected={filters.label}
          onToggle={(v) => toggle("label", v)}
          options={labels.map((l) => ({ value: l.id, label: l.name, icon: <span className="size-2 rounded-full" style={{ background: l.color }} /> }))}
        />
      ) : null}
      {cycles.length ? <MultiFilter title="Ciclo" selected={filters.cycle} onToggle={(v) => toggle("cycle", v)} options={cycles.map((c) => ({ value: c.id, label: c.name }))} /> : null}
      {modules.length ? <MultiFilter title="Módulo" selected={filters.module} onToggle={(v) => toggle("module", v)} options={modules.map((m) => ({ value: m.id, label: m.name }))} /> : null}
      {properties
        .filter((p) => p.type === "select")
        .map((p) => (
          <MultiFilter
            key={p.id}
            title={p.name}
            selected={filters.prop[p.id] ?? []}
            onToggle={(v) => {
              const cur = filters.prop[p.id] ?? [];
              onChange({ ...filters, prop: { ...filters.prop, [p.id]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } });
            }}
            options={p.options.map((o) => ({ value: o, label: o }))}
          />
        ))}
      {n ? (
        <button onClick={() => onChange(EMPTY_FILTERS)} className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
          <X className="size-3" /> Limpiar
        </button>
      ) : null}
      <SavedViews filters={filters} views={views} project={project} layout={layout} />
    </div>
  );
}

function MultiFilter({
  title,
  selected,
  options,
  onToggle,
}: {
  title: string;
  selected: string[];
  options: { value: string; label: string; icon?: React.ReactNode }[];
  onToggle: (v: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Filtrar por ${title.toLowerCase()}`}
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-md border px-1.5 hover:bg-accent",
          selected.length ? "border-primary/50 bg-primary/10 text-foreground" : "text-muted-foreground",
        )}
      >
        {title}
        {selected.length ? <span className="rounded bg-primary px-1 text-[0.75rem] text-primary-foreground tabular-nums">{selected.length}</span> : <ChevronDown className="size-3" />}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 gap-0 p-0">
        <Command>
          <CommandInput placeholder={`${title}…`} />
          <CommandList>
            <CommandEmpty>Sin resultados</CommandEmpty>
            {options.map((o) => (
              <CommandItem key={o.value} value={o.label} onSelect={() => onToggle(o.value)}>
                {o.icon}
                <span className="flex-1 truncate">{o.label}</span>
                {selected.includes(o.value) ? <Check className="size-3.5 text-muted-foreground" /> : null}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SavedViews({ filters, views, project, layout }: { filters: Filters; views: SavedViewDTO[]; project: { id: string; identifier: string }; layout: ViewLayout }) {
  const [name, setName] = useState("");
  const [, start] = useTransition();
  const save = () => {
    const n = name.trim();
    if (!n) return;
    start(async () => {
      const res = await createViewAction({ projectId: project.id, name: n, layout, query: serializeFilters(filters) });
      if (res.ok) {
        setName("");
        toast.success(`Vista “${n}” guardada`);
      } else toast.error(res.error);
    });
  };
  return (
    <Popover>
      <PopoverTrigger aria-label="Vistas guardadas" className="ml-auto inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-muted-foreground hover:bg-accent">
        <Bookmark className="size-3" /> Vistas{views.length ? <span className="tabular-nums">· {views.length}</span> : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-2 p-2">
        {views.length ? (
          <ul className="flex flex-col">
            {views.map((v) => (
              <li key={v.id} className="group flex items-center gap-1 rounded-md hover:bg-accent">
                <Link href={`/${project.identifier}/${v.layout}${v.query ? `?${v.query}` : ""}`} className="min-w-0 flex-1 truncate px-2 py-1.5 text-sm">
                  {v.name} <span className="text-xs text-muted-foreground">· {v.layout === "board" ? "Kanban" : v.layout === "table" ? "Tabla" : "Lista"}</span>
                </Link>
                <button
                  aria-label={`Eliminar vista ${v.name}`}
                  onClick={() => start(async () => void (await deleteViewAction(v.id, project.id)))}
                  className="mr-1 rounded p-1 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-2 py-1 text-xs text-muted-foreground">Aún no hay vistas guardadas.</p>
        )}
        <form
          className="flex items-center gap-1 border-t pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <input
            aria-label="Nombre de la vista"
            placeholder="Guardar filtros actuales como…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-7 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
          />
          <button disabled={!name.trim()} className="h-7 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground disabled:opacity-50">
            Guardar
          </button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
