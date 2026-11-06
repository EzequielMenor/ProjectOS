import Link from "next/link";
import { Plus } from "lucide-react";
import { ProjectLifecycleControl } from "@/components/project-lifecycle-control";
import { filterProjects, LIFECYCLE_FILTERS, VISIBILITY_FILTERS, isDefaultPortfolioQuery, type PortfolioQuery } from "@/lib/project-status";
import type { DashboardProject } from "@/server/services/project-dashboard";

const fieldClass =
  "h-8 w-full min-w-0 rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const linkClass = "rounded text-sm underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

const shortcuts: { label: string; status: PortfolioQuery["status"]; view: PortfolioQuery["view"] }[] = [
  { label: "En seguimiento", status: "all", view: "tracked" },
  { label: "En marcha", status: "active", view: "tracked" },
  { label: "Todos", status: "all", view: "all" },
  { label: "Pausados", status: "paused", view: "tracked" },
  { label: "Planificados", status: "planned", view: "tracked" },
  { label: "Terminados", status: "completed", view: "tracked" },
  { label: "Cancelados", status: "cancelled", view: "tracked" },
  { label: "Archivados", status: "all", view: "archived" },
];

function shortcutHref(query: PortfolioQuery, shortcut: (typeof shortcuts)[number]) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (shortcut.status !== "all") params.set("status", shortcut.status);
  if (shortcut.view !== "tracked") params.set("view", shortcut.view);
  const search = params.toString();
  return `/projects${search ? `?${search}` : ""}`;
}

/** `projects` is filtered; shortcut counts always use the complete portfolio. */
export function ProjectPortfolio({ projects, allProjects, query }: { projects: DashboardProject[]; allProjects: DashboardProject[]; query: PortfolioQuery }) {
  const total = allProjects.length;
  return (
    <div className="mx-auto h-full max-w-4xl overflow-y-auto px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Proyectos</h1>
        <Link
          href="/projects/new"
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Plus className="size-3.5" aria-hidden />
          Nuevo proyecto
        </Link>
      </div>

      {total === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Todavía no hay proyectos. <Link href="/projects/new" className={linkClass}>Crea el primero</Link>.
        </p>
      ) : (
        <>
          <nav aria-label="Vistas de proyectos" className="mt-6 flex flex-wrap gap-2">
            {shortcuts.map((shortcut) => {
              const count = filterProjects(allProjects, { q: "", status: shortcut.status, view: shortcut.view }).length;
              const current = query.status === shortcut.status && query.view === shortcut.view;
              return (
                <Link key={shortcut.label} href={shortcutHref(query, shortcut)} aria-current={current ? "page" : undefined}
                  className={`rounded-md border px-3 py-1.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${current ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
                  {shortcut.label} <span className="ml-1">{count}</span>
                </Link>
              );
            })}
          </nav>
          <p className="mt-2 text-xs text-muted-foreground">Recuento global de proyectos; los accesos conservan la búsqueda y sustituyen los filtros de estado y visibilidad.</p>
          <form method="get" action="/projects" role="search" aria-label="Buscar y filtrar proyectos" className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
              Buscar
              <input type="search" name="q" defaultValue={query.q} placeholder="Nombre, identificador u objetivo" maxLength={100} className={fieldClass} />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
              Estado
              <select name="status" defaultValue={query.status} className={fieldClass}>
                {LIFECYCLE_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
              Mostrar
              <select name="view" defaultValue={query.view} aria-describedby="portfolio-view-help" className={fieldClass}>
                {VISIBILITY_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </label>
            <p id="portfolio-view-help" className="text-xs text-muted-foreground sm:col-span-3">
              «En seguimiento» oculta los archivados y, mientras no elijas un estado, los terminados y cancelados. «Todos» incluye también los archivados.
              «Archivados» muestra solo los archivados. Archivar es independiente del estado.
            </p>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
              <button className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                Aplicar filtros
              </button>
              {isDefaultPortfolioQuery(query) ? null : <Link href="/projects" className={linkClass}>Limpiar filtros</Link>}
              <p role="status" className="ml-auto text-xs text-muted-foreground">
                {projects.length} de {total} {total === 1 ? "proyecto" : "proyectos"}
              </p>
            </div>
          </form>

          {projects.length === 0 ? (
            <p className="mt-6 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              Ningún proyecto coincide con estos filtros. <Link href="/projects" className={linkClass}>Limpiar filtros</Link>
            </p>
          ) : (
            <ul aria-label="Proyectos" className="mt-6 grid gap-3 sm:grid-cols-2">
              {projects.map((p) => (
                <li key={p.id} data-testid="project-row" className="flex min-w-0 flex-col gap-4 rounded-lg border bg-card p-4 text-card-foreground">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-1.5 size-2.5 shrink-0 rounded-sm" style={{ background: p.color }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link href={`/${p.identifier}/list`} className="min-w-0 break-words rounded text-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">{p.name}</Link>
                        <span className="font-mono text-xs text-muted-foreground">{p.identifier}</span>
                        {p.archived ? <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Archivado</span> : null}
                      </div>
                      <p className="mt-1 break-words text-sm text-muted-foreground">{p.description.trim() || "Sin objetivo definido."}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between gap-2"><span>Progreso</span><span>{p.percent === null ? "Sin tareas" : `${p.completed} de ${p.total} · ${p.percent}%`}</span></div>
                    {p.percent !== null ? <div role="progressbar" aria-label={`Progreso de ${p.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percent} aria-valuetext={`${p.completed} de ${p.total} tareas completadas`} className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${p.percent}%` }} /></div> : null}
                    <p className="text-xs text-muted-foreground">{p.started} en marcha</p>
                  </div>
                  <div className="space-y-1 break-words text-sm text-muted-foreground">
                    <p>Última actividad: {p.lastActivityAt ? <time dateTime={p.lastActivityAt.toISOString()}>{new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" }).format(p.lastActivityAt)} UTC</time> : "Sin actividad registrada"}</p>
                    <p>Próximo paso: {p.nextIssue ? <Link href={`/${p.identifier}/issues/${p.nextIssue.seq}`} className={linkClass}>{p.identifier}-{p.nextIssue.seq} · {p.nextIssue.title}</Link> : "Sin trabajo pendiente disponible"}</p>
                  </div>
                  <ProjectLifecycleControl key={`${p.id}:${p.status}`} projectId={p.id} projectName={p.name} status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
