import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { ProgressBar } from "@/components/planning/progress-bar";
import { StateIcon } from "@/lib/issue-meta";
import { PLANNING, type PlanningKind } from "@/lib/planning-navigation";
import { loadProject } from "@/lib/project-page";
import { getPlanningDetail } from "@/server/services/planning-detail";

export const metadata = { title: "Detalle de planificación" };
export const dynamic = "force-dynamic";
const fmt = (date: string) => new Intl.DateTimeFormat("es", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

export default async function PlanningPage({ params }: { params: Promise<{ project: string; kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (!Object.hasOwn(PLANNING, kind)) notFound();
  const project = await loadProject(params);
  const copy = PLANNING[kind as PlanningKind];
  const detail = await getPlanningDetail(project.id, kind as PlanningKind, id);
  if (!detail) notFound();
  const { item, issues } = detail;
  const issueHref = (seq: number) => `/${project.identifier}/issues/${seq}`;
  const groups = [
    { name: "Épicas", rows: issues.filter((row) => row.type === "epic") },
    { name: "Tickets", rows: issues.filter((row) => row.type !== "epic") },
  ];

  return (
    <div className="mx-auto h-full max-w-4xl overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
      <nav aria-label="Ruta de planificación" className="mb-6 flex flex-wrap gap-2 text-sm text-muted-foreground">
        <Link href={`/${project.identifier}/roadmap`} className="hover:underline">Roadmap</Link>
        <span aria-hidden>/</span>
        <Link href={`/${project.identifier}/${copy.path}`} className="hover:underline">{copy.label}</Link>
      </nav>
      <header className="rounded-xl border bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{copy.singular}</p>
        <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight">{item.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {item.from && item.to ? `${fmt(item.from)} → ${fmt(item.to)}` : item.to ? `Objetivo: ${fmt(item.to)}` : item.from ? `Inicio: ${fmt(item.from)}` : "Sin fechas"}
        </p>
        <div className="mt-4"><ProgressBar progress={item.progress} /></div>
        <p className="mt-2 text-xs text-muted-foreground">
          Progreso del trabajo asignado · {item.progress.started} en curso · {item.progress.cancelled} cancelados
        </p>
      </header>
      <section aria-labelledby="planning-goal" className="mt-6 rounded-xl border p-5">
        <h2 id="planning-goal" className="mb-3 text-sm font-semibold">Objetivo</h2>
        {item.description ? <Markdown>{item.description}</Markdown> : <p className="text-sm text-muted-foreground">Sin descripción.</p>}
      </section>
      {!issues.length ? (
        <div className="mt-6 rounded-xl border border-dashed p-6">
          <p className="text-sm text-muted-foreground">Todavía no hay trabajo asignado.</p>
          <Link href={`/${project.identifier}/list`} className="mt-2 inline-block text-sm text-primary hover:underline">Abrir tickets para asignar trabajo</Link>
        </div>
      ) : groups.filter((group) => group.rows.length).map((group) => (
        <section key={group.name} aria-label={group.name} className="mt-6">
          <h2 className="mb-3 text-sm font-semibold">{group.name} <span className="text-muted-foreground">({group.rows.length})</span></h2>
          <ul className="divide-y rounded-xl border">
            {group.rows.map((row) => (
              <li key={row.id} className="p-4">
                <Link href={issueHref(row.seq)} className="flex items-start gap-2 rounded-sm text-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-ring">
                  <StateIcon group={row.state.group} color={row.state.color} />
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{project.identifier}-{row.seq}</span>
                  <span className="min-w-0 flex-1 break-words font-medium">{row.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{row.state.name}</span>
                </Link>
                {row.parent ? (
                  <Link href={issueHref(row.parent.seq)} className="mt-2 inline-block text-xs text-muted-foreground hover:underline">Parte de {project.identifier}-{row.parent.seq}: {row.parent.title}</Link>
                ) : null}
                {row.blockers.length ? (
                  <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Bloqueado por</span>
                    {row.blockers.map((blocker) => (
                      <Link key={blocker.id} href={issueHref(blocker.seq)} title={blocker.title} className="text-primary hover:underline">{project.identifier}-{blocker.seq}</Link>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
