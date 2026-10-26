"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Columns3, LayoutList, Moon, Plus, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type P = { id: string; identifier: string; name: string; color: string };

export function Sidebar({ projects }: { projects: P[] }) {
  const pathname = usePathname();
  const params = useParams<{ project?: string }>();
  const { resolvedTheme, setTheme } = useTheme();
  const current = params.project?.toUpperCase();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex" aria-label="Navegación">
      <div className="flex h-12 items-center gap-2 px-4">
        <div className="grid size-5 place-items-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">P</div>
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
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <div className="mb-1 flex items-center px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
                  "flex h-7 items-center gap-2 rounded-md px-2 text-[13px] hover:bg-sidebar-accent",
                  active && "font-medium text-sidebar-accent-foreground",
                )}
              >
                <span className="size-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
                <span className="truncate">{p.name}</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">{p.identifier}</span>
              </Link>
              {active ? (
                <div className="ml-4 border-l pl-2">
                  <SubLink href={`/${p.identifier}/list`} icon={<LayoutList className="size-3.5" />} label="Lista" active={pathname.endsWith("/list")} />
                  <SubLink href={`/${p.identifier}/board`} icon={<Columns3 className="size-3.5" />} label="Kanban" active={pathname.endsWith("/board")} />
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function SubLink({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-7 items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
        active && "bg-sidebar-accent text-foreground",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
