"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Boxes, CalendarRange, Columns3, DatabaseBackup, FileText, Flag, GanttChart, KeyRound, LayoutList, Moon, Plus, Settings, Sun, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PaletteButton } from "@/components/command-palette";

type P = { id: string; identifier: string; name: string; color: string };

export function Sidebar({ projects }: { projects: P[] }) {
  const pathname = usePathname();
  const params = useParams<{ project?: string }>();
  const { resolvedTheme, setTheme } = useTheme();
  const current = params.project?.toUpperCase();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex" aria-label="Navegación">
      <div className="flex h-12 items-center gap-2 px-4">
        <div className="grid size-5 place-items-center rounded-md bg-primary text-[0.8125rem] font-bold text-primary-foreground">P</div>
        <span className="text-sm font-semibold tracking-tight">ProjectOS</span>
        <button
          aria-label="Cambiar tema"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="ml-auto rounded p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          <Sun className="hidden size-4 dark:block" />
          <Moon className="size-4 dark:hidden" />
        </button>
      </div>
      <PaletteButton />
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <div className="mb-1 flex items-center px-2 text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">
          Proyectos
          <Link href="/projects/new" aria-label="Nuevo proyecto" className="ml-auto rounded p-0.5 hover:bg-sidebar-accent hover:text-foreground">
            <Plus className="size-3.5" />
          </Link>
        </div>
        {projects.length === 0 ? <p className="px-2 py-2 text-xs text-muted-foreground">Sin proyectos todavía.</p> : null}
        {projects.map((p) => {
          const active = current === p.identifier;
          return (
            <div key={p.id} className="mb-0.5">
              <Link
                href={`/${p.identifier}/list`}
                className={cn(
                  "flex h-7 items-center gap-2 rounded-md px-2 text-[0.875rem] hover:bg-sidebar-accent",
                  active && "font-medium text-sidebar-accent-foreground",
                )}
              >
                <span className="size-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
                <span className="truncate">{p.name}</span>
                <span className="ml-auto font-mono text-[0.75rem] text-muted-foreground">{p.identifier}</span>
              </Link>
              {active ? (
                <div className="ml-4 border-l pl-2">
                  <SubLink href={`/${p.identifier}/list`} icon={<LayoutList className="size-3.5" />} label="Lista" active={pathname.endsWith("/list")} />
                  <SubLink href={`/${p.identifier}/board`} icon={<Columns3 className="size-3.5" />} label="Kanban" active={pathname.endsWith("/board")} />
                  <SubLink href={`/${p.identifier}/table`} icon={<Table2 className="size-3.5" />} label="Tabla" active={pathname.endsWith("/table")} />
                  <SubLink href={`/${p.identifier}/cycles`} icon={<CalendarRange className="size-3.5" />} label="Ciclos" active={pathname.endsWith("/cycles")} />
                  <SubLink href={`/${p.identifier}/modules`} icon={<Boxes className="size-3.5" />} label="Módulos" active={pathname.endsWith("/modules")} />
                  <SubLink href={`/${p.identifier}/milestones`} icon={<Flag className="size-3.5" />} label="Hitos" active={pathname.endsWith("/milestones")} />
                  <SubLink href={`/${p.identifier}/roadmap`} icon={<GanttChart className="size-3.5" />} label="Roadmap" active={pathname.endsWith("/roadmap")} />
                  <SubLink href={`/${p.identifier}/pages`} icon={<FileText className="size-3.5" />} label="Docs" active={pathname.includes("/pages")} />
                  <SubLink href={`/${p.identifier}/settings`} icon={<Settings className="size-3.5" />} label="Ajustes" active={pathname.endsWith("/settings")} />
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
      <div className="border-t p-2">
        <SubLink href="/settings/tokens" icon={<KeyRound className="size-3.5" />} label="Tokens de API" active={pathname.startsWith("/settings/tokens")} />
        <SubLink href="/settings/backup" icon={<DatabaseBackup className="size-3.5" />} label="Copias de seguridad" active={pathname.startsWith("/settings/backup")} />
      </div>
    </aside>
  );
}

function SubLink({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-7 items-center gap-2 rounded-md px-2 text-[0.875rem] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
        active && "bg-sidebar-accent text-foreground",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
