export const PLANNING = {
  milestone: { path: "milestones", label: "Hitos", singular: "Hito" },
  module: { path: "modules", label: "Módulos", singular: "Módulo" },
  cycle: { path: "cycles", label: "Ciclos", singular: "Ciclo" },
} as const;

export type PlanningKind = keyof typeof PLANNING;

export const planningHref = (project: string, kind: PlanningKind, id: string) =>
  `/${encodeURIComponent(project)}/planning/${kind}/${encodeURIComponent(id)}`;
