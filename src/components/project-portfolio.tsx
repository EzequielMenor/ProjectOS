import Link from "next/link";
import { Plus } from "lucide-react";
import { ProjectLifecycleControl } from "@/components/project-lifecycle-control";
import { LIFECYCLE_FILTERS, VISIBILITY_FILTERS, isDefaultPortfolioQuery, type PortfolioQuery } from "@/lib/project-status";
import type { ProjectStatus } from "@/db/schema";

export type PortfolioProjectRow = {
  id: string;
  identifier: string;
  name: string;
  description: string;
  color: string;
  status: ProjectStatus | null;
  archived: boolean;
};

const fieldClass =
  "h-8 w-full min-w-0 rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const linkClass = "rounded text-sm underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

/** `projects` is already filtered; `total` counts every project, archived included. */
export function ProjectPortfolio({ projects, total, query }: { projects: PortfolioProjectRow[]; total: number; query: PortfolioQuery }) {
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
            <ul aria-label="Proyectos" className="mt-6 divide-y rounded-lg border">
              {projects.map((p) => (
                <li key={p.id} data-testid="project-row" className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:gap-4">
                  <span className="mt-1.5 hidden size-2.5 shrink-0 rounded-sm sm:block" style={{ background: p.color }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link href={`/${p.identifier}/list`} className="min-w-0 break-words rounded text-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                        {p.name}
                      </Link>
                      <span className="font-mono text-xs text-muted-foreground">{p.identifier}</span>
                      {p.archived ? <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Archivado</span> : null}
                    </div>
                    <p className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground">{p.description.trim() || "Sin objetivo definido."}</p>
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
