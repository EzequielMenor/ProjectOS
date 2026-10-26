"use client";

import { useRouter, useParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { Boxes, CalendarRange, Columns3, DatabaseBackup, FileText, Flag, FolderPlus, GanttChart, KeyRound, LayoutList, Moon, Search } from "lucide-react";
import { searchAction, type PageHit, type SearchHit } from "@/app/actions";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { PriorityIcon, StateIcon } from "@/lib/issue-meta";

type P = { identifier: string; name: string; color: string };
export const OPEN_PALETTE = "projectos:palette";

const VIEWS = [
  { slug: "list", label: "Lista", key: "l", icon: LayoutList },
  { slug: "board", label: "Kanban", key: "b", icon: Columns3 },
  { slug: "cycles", label: "Ciclos", key: "c", icon: CalendarRange },
  { slug: "modules", label: "Módulos", key: "m", icon: Boxes },
  { slug: "milestones", label: "Hitos", key: "h", icon: Flag },
  { slug: "roadmap", label: "Roadmap", key: "r", icon: GanttChart },
  { slug: "pages", label: "Docs", key: "d", icon: FileText },
] as const;

const inField = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable=true]");

export function CommandPalette({ projects }: { projects: P[] }) {
  const router = useRouter();
  const params = useParams<{ project?: string }>();
  const { resolvedTheme, setTheme } = useTheme();
  const current = params.project?.toUpperCase();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ q: string; hits: SearchHit[]; pages: PageHit[] }>({ q: "", hits: [], pages: [] });
  const seq = useRef(0);
  const chord = useRef<number | null>(null);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  // Global shortcuts: Ctrl/Cmd+K or "/" open; "g" then a letter jumps between project views.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || inField(e.target) || (e.target as HTMLElement).closest?.("[role=dialog]")) return;
      if (e.key === "/") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "g") {
        chord.current = Date.now();
      } else if (chord.current && Date.now() - chord.current < 1200 && current) {
        const view = VIEWS.find((v) => v.key === e.key);
        chord.current = null;
        if (view) router.push(`/${current}/${view.slug}`);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE, onOpen);
    };
  }, [current, router]);

  // Debounced server search; stale responses are dropped.
  useEffect(() => {
    const q = query.trim();
    const id = ++seq.current;
    if (!q) return;
    const t = setTimeout(async () => {
      const res = await searchAction(q).catch(() => ({ issues: [], pages: [] }));
      if (id === seq.current) setFound({ q, hits: res.issues, pages: res.pages });
    }, 120);
    return () => clearTimeout(t);
  }, [query]);

  // Only show hits for what is typed now; otherwise Enter could open a result of the previous text.
  const fresh = found.q === query.trim();
  const hits = fresh ? found.hits : [];
  const pageHits = fresh ? found.pages : [];
  const q = query.trim().toLowerCase();
  const match = (label: string) => !q || label.toLowerCase().includes(q);
  const views = current ? VIEWS.filter((v) => match(v.label)) : [];
  const projs = projects.filter((p) => match(p.name) || match(p.identifier));
  const settings = [
    { href: "/settings/tokens", label: "Tokens de API", icon: KeyRound },
    { href: "/settings/backup", label: "Copias de seguridad", icon: DatabaseBackup },
  ].filter((s) => match(s.label));
  const themeLabel = resolvedTheme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro";

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
      title="Paleta de comandos"
      description="Busca issues, proyectos y vistas"
      className="sm:max-w-xl"
    >
      {/* cmdk's own filtering is off: groups are filtered above and issue hits come from the server. */}
      <Command shouldFilter={false}>
        <CommandInput value={query} onValueChange={setQuery} placeholder="Busca un issue (FICH-12 o texto), proyecto o acción…" />
        <CommandList>
          {hits.length ? (
            <CommandGroup heading="Issues">
              {hits.map((h) => (
                <CommandItem key={h.key} value={`issue ${h.key}`} onSelect={() => go(`/${h.key.split("-")[0]}/issues/${h.key.split("-")[1]}`)}>
                  <StateIcon group={h.state.group} color={h.state.color} />
                  <span className="font-mono text-xs text-muted-foreground">{h.key}</span>
                  <span className="truncate">{h.title}</span>
                  <PriorityIcon priority={h.priority} />
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {pageHits.length ? (
            <CommandGroup heading="Docs">
              {pageHits.map((p) => (
                <CommandItem key={p.id} value={`page ${p.id}`} onSelect={() => go(`/${p.identifier}/pages/${p.id}`)}>
                  <FileText className="size-4" />
                  <span className="truncate">{p.title}</span>
                  <CommandShortcut>{p.identifier}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {views.length ? (
            <CommandGroup heading={`Vistas de ${current}`}>
              {views.map((v) => (
                <CommandItem key={v.slug} value={`view ${v.slug}`} onSelect={() => go(`/${current}/${v.slug}`)}>
                  <v.icon className="size-4" />
                  {v.label}
                  <CommandShortcut>g {v.key}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {projs.length ? (
            <CommandGroup heading="Proyectos">
              {projs.map((p) => (
                <CommandItem key={p.identifier} value={`project ${p.identifier}`} onSelect={() => go(`/${p.identifier}/list`)}>
                  <span className="size-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
                  {p.name}
                  <CommandShortcut>{p.identifier}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          <CommandGroup heading="Acciones">
            {match("Nuevo proyecto") ? (
              <CommandItem value="action new-project" onSelect={() => go("/projects/new")}>
                <FolderPlus className="size-4" />
                Nuevo proyecto
              </CommandItem>
            ) : null}
            {match(themeLabel) || match("tema") ? (
              <CommandItem
                value="action theme"
                onSelect={() => {
                  setTheme(resolvedTheme === "dark" ? "light" : "dark");
                  setOpen(false);
                }}
              >
                <Moon className="size-4" />
                {themeLabel}
              </CommandItem>
            ) : null}
            {settings.map((s) => (
              <CommandItem key={s.href} value={`setting ${s.href}`} onSelect={() => go(s.href)}>
                <s.icon className="size-4" />
                {s.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandEmpty>Sin resultados para “{query}”.</CommandEmpty>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

export function PaletteButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE))}
      className="mx-2 mb-1 flex h-7 items-center gap-2 rounded-md border bg-background/50 px-2 text-[13px] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
    >
      <Search className="size-3.5" />
      Buscar
      <kbd className="ml-auto rounded border px-1 font-mono text-[10px]">Ctrl K</kbd>
    </button>
  );
}
