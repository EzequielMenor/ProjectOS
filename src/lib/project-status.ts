// Type-only import: this module is used by client components and must not bundle the database schema.
import type { ProjectStatus } from "@/db/schema";

export const UNCLASSIFIED_LABEL = "Sin clasificar";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: "Planificado",
  active: "En marcha",
  paused: "Pausado",
  completed: "Terminado",
  cancelled: "Cancelado",
};

/** Lifecycle order, as shown in selectors. */
export const PROJECT_STATUS_ORDER: readonly ProjectStatus[] = ["planned", "active", "paused", "completed", "cancelled"];

export const statusLabel = (status: ProjectStatus | null) => (status ? PROJECT_STATUS_LABELS[status] : UNCLASSIFIED_LABEL);

/** Lifecycle filter: any state, only unclassified projects, or one status. */
export type LifecycleFilter = "all" | "unclassified" | ProjectStatus;
/** Visibility filter, independent of lifecycle: `tracked` hides archived projects (and finished/cancelled ones unless asked for). */
export type VisibilityFilter = "tracked" | "all" | "archived";
export type PortfolioQuery = { q: string; status: LifecycleFilter; view: VisibilityFilter };

export const DEFAULT_PORTFOLIO_QUERY: PortfolioQuery = { q: "", status: "all", view: "tracked" };

export const LIFECYCLE_FILTERS: { value: LifecycleFilter; label: string }[] = [
  { value: "all", label: "Cualquier estado" },
  ...PROJECT_STATUS_ORDER.map((value) => ({ value, label: PROJECT_STATUS_LABELS[value] })),
  { value: "unclassified", label: UNCLASSIFIED_LABEL },
];

export const VISIBILITY_FILTERS: { value: VisibilityFilter; label: string }[] = [
  { value: "tracked", label: "En seguimiento" },
  { value: "all", label: "Todos (con archivados)" },
  { value: "archived", label: "Archivados" },
];

const MAX_QUERY_LENGTH = 100;

type RawParams = Record<string, string | string[] | undefined>;

/** Reads `q`, `status` and `view` from the URL: the first value wins, unknown values fall back to the defaults. */
export function parsePortfolioQuery(params: RawParams): PortfolioQuery {
  const first = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const status = first("status");
  const view = first("view");
  return {
    q: first("q").trim().slice(0, MAX_QUERY_LENGTH),
    status: LIFECYCLE_FILTERS.some((f) => f.value === status) ? (status as LifecycleFilter) : DEFAULT_PORTFOLIO_QUERY.status,
    view: VISIBILITY_FILTERS.some((f) => f.value === view) ? (view as VisibilityFilter) : DEFAULT_PORTFOLIO_QUERY.view,
  };
}

export const isDefaultPortfolioQuery = (query: PortfolioQuery) =>
  query.q === "" && query.status === DEFAULT_PORTFOLIO_QUERY.status && query.view === DEFAULT_PORTFOLIO_QUERY.view;

export type PortfolioProject = { identifier: string; name: string; description: string; status: ProjectStatus | null; archived: boolean };

const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * Applies the portfolio filters. Search is case- and accent-insensitive and every word must appear in the name,
 * identifier or description (the project's objective). Visibility only decides archived projects; the default
 * "En seguimiento" view additionally hides finished and cancelled projects unless a lifecycle is chosen explicitly.
 */
export function filterProjects<T extends PortfolioProject>(projects: T[], query: PortfolioQuery): T[] {
  const words = normalize(query.q).split(/\s+/).filter(Boolean);
  return projects.filter((p) => {
    if (query.view === "archived" ? !p.archived : query.view === "tracked" && p.archived) return false;
    if (query.status === "unclassified" ? p.status !== null : query.status !== "all" && p.status !== query.status) return false;
    if (query.view === "tracked" && query.status === "all" && (p.status === "completed" || p.status === "cancelled")) return false;
    const haystack = normalize(`${p.name} ${p.identifier} ${p.description}`);
    return words.every((w) => haystack.includes(w));
  });
}
