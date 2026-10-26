import { loadProject } from "@/lib/project-page";
import { listCycles, listMilestones, listModules } from "@/server/services/planning";

export const metadata = { title: "Roadmap" };
export const dynamic = "force-dynamic";

type Bar = { id: string; label: string; kind: "module" | "cycle" | "milestone"; from: string | null; to: string | null };
const DAY = 86_400_000;
const t = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
const fmt = new Intl.DateTimeFormat("es", { month: "short", year: "2-digit", timeZone: "UTC" });

export default async function RoadmapPage({ params }: { params: Promise<{ project: string }> }) {
  const project = await loadProject(params);
  const [mods, cycles, miles] = await Promise.all([listModules(project.id), listCycles(project.id), listMilestones(project.id)]);
  const bars: Bar[] = [
    ...miles.map((m) => ({ id: m.id, label: m.name, kind: "milestone" as const, from: m.targetDate, to: m.targetDate })),
    ...mods.map((m) => ({ id: m.id, label: m.name, kind: "module" as const, from: m.startDate ?? m.targetDate, to: m.targetDate ?? m.startDate })),
    ...cycles.map((c) => ({ id: c.id, label: c.name, kind: "cycle" as const, from: c.startDate ?? c.endDate, to: c.endDate ?? c.startDate })),
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
  const kindLabel = { milestone: "Hito", module: "Módulo", cycle: "Ciclo" } as const;

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto px-6 py-8">
      <h1 className="text-lg font-semibold tracking-tight">Roadmap</h1>
      {bars.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Aún no hay nada que planificar. Crea módulos, ciclos o hitos con fechas y aparecerán aquí.
        </p>
      ) : (
        <>
          {dated.length ? (
            <div className="mt-6 rounded-lg border" role="img" aria-label="Cronograma">
              <div className="relative h-7 border-b text-[10px] text-muted-foreground">
                {months.map((m) => (
                  <span key={m.label + m.left} className="absolute top-1.5 border-l pl-1" style={{ left: `${m.left}%` }}>{m.label}</span>
                ))}
              </div>
              <ul>
                {dated.map((b) => (
                  <li key={b.kind + b.id} data-testid="roadmap-row" className="relative h-9 border-b last:border-b-0">
                    <span
                      title={`${kindLabel[b.kind]}: ${b.label}`}
                      className={`absolute top-2.5 h-4 ${color[b.kind]} ${b.kind === "milestone" ? "w-4 rotate-45 rounded-sm" : "rounded"}`}
                      style={b.kind === "milestone" ? { left: `calc(${pos(b.from!)}% - 8px)` } : { left: `${pos(b.from!)}%`, width: `max(${pos(b.to!) - pos(b.from!)}%, 6px)` }}
                    />
                    <span className="absolute top-2 text-xs" style={{ left: `calc(${Math.min(pos(b.to!), 80)}% + 14px)` }}>
                      {b.label} <span className="text-muted-foreground">· {kindLabel[b.kind]}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {undated.length ? (
            <section className="mt-6">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Sin fechas</h2>
              <ul className="text-sm">
                {undated.map((b) => (
                  <li key={b.kind + b.id} className="py-1">{b.label} <span className="text-xs text-muted-foreground">· {kindLabel[b.kind]}</span></li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
