"use client";

import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useTheme } from "next-themes";
import { useState } from "react";
import { Bookmark, Boxes, CalendarRange, Columns3, DatabaseBackup, FileText, Flag, GanttChart, KeyRound, Layers, LayoutList, Menu, Moon, Plus, Search, Settings, Sun, Table2, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { OPEN_PALETTE, PaletteButton } from "@/components/command-palette";
import { TextSizeControl } from "@/components/text-size-control";

type P = { id: string; identifier: string; name: string; color: string };

export type SidebarView = { id: string; projectId: string; name: string; layout: "list" | "board" | "table"; query: string };
type SidebarProps = { projects: P[]; views: SidebarView[]; uiSize: number };

/** Desktop: fixed sidebar. Narrow screens: a top bar whose menu button opens the same navigation as a drawer. */
export function Sidebar(props: SidebarProps) {
  return (
    <>
      <MobileBar {...props} />
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex" aria-label="Navegación">
        <SidebarBody {...props} />
      </aside>
    </>
  );
}

function MobileBar(props: SidebarProps) {
  const [open, setOpen] = useState(false);
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-sidebar px-2 text-sidebar-foreground md:hidden">
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Trigger aria-label="Abrir menú" className="grid size-9 place-items-center rounded-md hover:bg-sidebar-accent">
          <Menu className="size-5" />
        </DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <DialogPrimitive.Popup
            aria-label="Navegación"
            // any link (or the search button) inside closes the drawer, so navigating never leaves it open over the new page
            onClickCapture={(e) => (e.target as HTMLElement).closest("a, [data-palette-button]") && setOpen(false)}
            className="fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-xl outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
          >
            <DialogPrimitive.Title className="sr-only">Navegación</DialogPrimitive.Title>
            <DialogPrimitive.Close aria-label="Cerrar menú" className="absolute top-2 right-2 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent">
              <X className="size-4" />
            </DialogPrimitive.Close>
            <SidebarBody {...props} />
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <span className="text-sm font-semibold tracking-tight">ProjectOS</span>
      <button
        type="button"
        aria-label="Buscar"
        onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE))}
        className="ml-auto grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
      >
        <Search className="size-5" />
      </button>
    </header>
  );
}

function SidebarBody({ projects, views, uiSize }: SidebarProps) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const params = useParams<{ project?: string }>();
  const { resolvedTheme, setTheme } = useTheme();
  const current = params.project?.toUpperCase();

  return (
    <>
      <div className="flex h-12 items-center gap-2 pr-12 pl-4 md:pr-4">
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
          const projectViews = views.filter((v) => v.projectId === p.id);
          const onSavedView = projectViews.some((v) => pathname.endsWith(`/${v.layout}`) && search === v.query);
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
                  <SubLink href={`/${p.identifier}/list`} icon={<LayoutList className="size-3.5" />} label="Lista" active={pathname.endsWith("/list") && !onSavedView} />
                  <SubLink href={`/${p.identifier}/board`} icon={<Columns3 className="size-3.5" />} label="Kanban" active={pathname.endsWith("/board") && !onSavedView} />
                  <SubLink href={`/${p.identifier}/table`} icon={<Table2 className="size-3.5" />} label="Tabla" active={pathname.endsWith("/table") && !onSavedView} />
                  <SubLink href={`/${p.identifier}/epics`} icon={<Layers className="size-3.5" />} label="Épicas" active={pathname.endsWith("/epics")} />
                  <SubLink href={`/${p.identifier}/cycles`} icon={<CalendarRange className="size-3.5" />} label="Ciclos" active={pathname.endsWith("/cycles")} />
                  <SubLink href={`/${p.identifier}/modules`} icon={<Boxes className="size-3.5" />} label="Módulos" active={pathname.endsWith("/modules")} />
                  <SubLink href={`/${p.identifier}/milestones`} icon={<Flag className="size-3.5" />} label="Hitos" active={pathname.endsWith("/milestones")} />
                  <SubLink href={`/${p.identifier}/roadmap`} icon={<GanttChart className="size-3.5" />} label="Roadmap" active={pathname.endsWith("/roadmap")} />
                  <SubLink href={`/${p.identifier}/pages`} icon={<FileText className="size-3.5" />} label="Docs" active={pathname.includes("/pages")} />
                  <SubLink href={`/${p.identifier}/settings`} icon={<Settings className="size-3.5" />} label="Ajustes" active={pathname.endsWith("/settings")} />
                  {projectViews.length ? (
                    <div role="group" aria-label="Vistas guardadas" className="mt-1 border-t pt-1">
                      {projectViews.map((v) => (
                          <SubLink
                            key={v.id}
                            href={`/${p.identifier}/${v.layout}${v.query ? `?${v.query}` : ""}`}
                            icon={<Bookmark className="size-3.5" />}
                            label={v.name}
                            active={pathname.endsWith(`/${v.layout}`) && search === v.query}
                          />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
      <div className="border-t p-2">
        <SubLink href="/settings/members" icon={<Users className="size-3.5" />} label="Miembros" active={pathname.startsWith("/settings/members")} />
        <SubLink href="/settings/tokens" icon={<KeyRound className="size-3.5" />} label="Tokens de API" active={pathname.startsWith("/settings/tokens")} />
        <SubLink href="/settings/backup" icon={<DatabaseBackup className="size-3.5" />} label="Copias de seguridad" active={pathname.startsWith("/settings/backup")} />
        <TextSizeControl initial={uiSize} />
      </div>
    </>
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
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );
}
