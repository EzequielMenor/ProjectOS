import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { loadProject } from "@/lib/project-page";
import { PLANNING, planningHref, type PlanningKind } from "@/lib/planning-navigation";
import { ProgressBar } from "@/components/planning/progress-bar";
import { listCycles, listMilestones, listModules, type Progress } from "@/server/services/planning";

export const metadata = { title: "Roadmap" };
export const dynamic = "force-dynamic";

type Bar = { id: string; label: string; description: string; progress: Progress; kind: PlanningKind; from: string | null; to: string | null };
const DAY = 86_400_000;
const t = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
const fmt = new Intl.DateTimeFormat("es", { month: "short", year: "2-digit", timeZone: "UTC" });

export default async function RoadmapPage({ params }: { params: Promise<{ project: string }> }) {
  const project = await loadProject(params);
  const [mods, cycles, miles] = await Promise.all([listModules(project.id), listCycles(project.id), listMilestones(project.id)]);
  const bars: Bar[] = [
    ...miles.map((m) => ({ id: m.id, label: m.name, description: m.description, progress: m.progress, kind: "milestone" as const, from: m.targetDate, to: m.targetDate })),
    ...mods.map((m) => ({ id: m.id, label: m.name, description: m.description, progress: m.progress, kind: "module" as const, from: m.startDate ?? m.targetDate, to: m.targetDate ?? m.startDate })),
    ...cycles.map((c) => ({ id: c.id, label: c.name, description: c.description, progress: c.progress, kind: "cycle" as const, from: c.startDate ?? c.endDate, to: c.endDate ?? c.startDate })),
  ];
  const dated = bars.filter((b) => b.from && b.to);
  const undated = bars.filter((b) => !(b.from && b.to));
  const min = dated.length ? Math.min(...dated.map((b) => t(b.from!))) - 3 * DAY : 0;
  const max = dated.length ? Math.max(...dated.map((b) => t(b.to!))) + 3 * DAY : 1;
  const span = Math.max(max - min, DAY);
  const pos = (d: string) => ((t(d) - min) / span) * 100;
  const months: { label: string; left: number }[] = [];
  if (dated.length) {
    const d = new Date(min);
    d.setUTCDate(1);
    for (let i = 0; i < 60 && d.getTime() <= max; i++) {
      if (d.getTime() >= min) months.push({ label: fmt.format(d), left: ((d.getTime() - min) / span) * 100 });
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
  }
  const color = { milestone: "bg-violet-500", module: "bg-sky-500", cycle: "bg-emerald-500" } as const;

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Roadmap</h1>
        <p className="mt-2 text-sm text-muted-foreground">Del objetivo al trabajo concreto. Abre un hito, módulo o ciclo para ver sus tickets y bloqueos.</p>
        <nav aria-label="Planificación" className="mt-4 flex flex-wrap gap-2">
          {Object.entries(PLANNING).map(([kind, copy]) => (
            <Link key={kind} href={`/${project.identifier}/${copy.path}`} className="rounded-full border px-3 py-1.5 text-xs hover:bg-accent">{copy.label}</Link>
          ))}
        </nav>
      </header>
      {bars.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aún no hay nada que planificar. Crea módulos, ciclos o hitos; aparecerán aquí aunque no tengan fechas.
        </p>
      ) : (
        <>
          {dated.length ? (
            <section aria-label="Cronograma" className="mt-6 overflow-x-auto rounded-xl border">
              <div className="min-w-[640px]">
                <div className="flex h-8 border-b text-xs text-muted-foreground">
                  <span className="w-56 shrink-0 px-4 py-2">Con fechas · {dated.length}</span>
                  <div className="relative mr-4 flex-1 overflow-hidden">
                    {months.map((m) => <span key={m.label + m.left} className="absolute top-2 whitespace-nowrap border-l pl-1" style={{ left: `${m.left}%` }}>{m.label}</span>)}
                  </div>
                </div>
                <ul className="divide-y">
                  {dated.map((b) => (
                    <li key={b.kind + b.id} data-testid="roadmap-row">
                      <Link href={planningHref(project.identifier, b.kind, b.id)} aria-label={b.label} className="flex items-center gap-4 p-4 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
                        <div className="w-48 shrink-0">
                          <p className="text-xs text-muted-foreground">{PLANNING[b.kind].singular}</p>
                          <p className="mb-2 break-words text-sm font-medium">{b.label}</p>
                          <ProgressBar progress={b.progress} />
                        </div>
                        <div className="relative h-8 min-w-0 flex-1" aria-hidden>
                          <span className={`absolute top-2 h-4 ${color[b.kind]} ${b.kind === "milestone" ? "w-4 rotate-45 rounded-sm" : "rounded"}`} style={b.kind === "milestone" ? { left: `calc(${pos(b.from!)}% - 8px)` } : { left: `${pos(b.from!)}%`, width: `max(${pos(b.to!) - pos(b.from!)}%, 6px)` }} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}
          {undated.length ? (
            <section className="mt-8" aria-labelledby="undated-plans">
              <h2 id="undated-plans" className="text-sm font-semibold">Sin fechas</h2>
              <p className="mt-1 text-xs text-muted-foreground">No hace falta fijar una fecha para organizar y recorrer el trabajo.</p>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {undated.map((b) => (
                  <li key={b.kind + b.id}>
                    <Link href={planningHref(project.identifier, b.kind, b.id)} aria-label={b.label} className="flex h-full flex-col rounded-xl border bg-card p-5 hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-ring">
                      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{PLANNING[b.kind].singular}</span><ArrowUpRight className="size-4" aria-hidden /></div>
                      <h3 className="mt-2 break-words text-base font-semibold">{b.label}</h3>
                      <p className="mb-5 mt-2 line-clamp-3 break-words text-sm text-muted-foreground">{b.description || "Abre para ver el trabajo asociado."}</p>
                      <div className="mt-auto"><ProgressBar progress={b.progress} /></div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
