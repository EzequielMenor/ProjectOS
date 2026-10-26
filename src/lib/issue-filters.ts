import type { Priority } from "@/db/schema";
import type { IssueDTO } from "@/server/dto";

/**
 * Filter state shared by the filter bar, the URL and saved views. Empty arrays mean "no filter".
 * `prop` holds the accepted values of each custom property, by property id (`p.<id>=a,b` in the URL).
 */
export type Filters = {
  state: string[];
  priority: Priority[];
  label: string[];
  cycle: string[];
  module: string[];
  prop: Record<string, string[]>;
  q: string;
};
export const EMPTY_FILTERS: Filters = { state: [], priority: [], label: [], cycle: [], module: [], prop: {}, q: "" };

const LIST_KEYS = ["state", "priority", "label", "cycle", "module"] as const;
const PROP_PREFIX = "p.";

export function parseFilters(params: URLSearchParams | { get(k: string): string | null; entries?: () => IterableIterator<[string, string]> }): Filters {
  const list = (k: string) => (params.get(k) ?? "").split(",").filter(Boolean);
  const prop: Record<string, string[]> = {};
  if (params.entries) {
    for (const [k, v] of params.entries()) {
      const values = v.split(",").filter(Boolean);
      if (k.startsWith(PROP_PREFIX) && values.length) prop[k.slice(PROP_PREFIX.length)] = values;
    }
  }
  return {
    state: list("state"),
    priority: list("priority") as Priority[],
    label: list("label"),
    cycle: list("cycle"),
    module: list("module"),
    prop,
    q: params.get("q") ?? "",
  };
}

export function serializeFilters(f: Filters): string {
  const p = new URLSearchParams();
  for (const k of LIST_KEYS) if (f[k].length) p.set(k, f[k].join(","));
  for (const [id, values] of Object.entries(f.prop)) if (values.length) p.set(PROP_PREFIX + id, values.join(","));
  if (f.q.trim()) p.set("q", f.q.trim());
  return p.toString();
}

export const activeCount = (f: Filters) =>
  LIST_KEYS.reduce((n, k) => n + (f[k].length ? 1 : 0), 0) + Object.values(f.prop).filter((v) => v.length).length + (f.q.trim() ? 1 : 0);

export function applyFilters(issues: IssueDTO[], f: Filters): IssueDTO[] {
  const q = f.q.trim().toLowerCase();
  const props = Object.entries(f.prop).filter(([, v]) => v.length);
  return issues.filter(
    (i) =>
      (!f.state.length || f.state.includes(i.stateId)) &&
      (!f.priority.length || f.priority.includes(i.priority)) &&
      (!f.label.length || i.labels.some((l) => f.label.includes(l.id))) &&
      (!f.cycle.length || (i.cycleId !== null && f.cycle.includes(i.cycleId))) &&
      (!f.module.length || i.moduleIds.some((m) => f.module.includes(m))) &&
      props.every(([id, values]) => i.properties[id] !== undefined && values.includes(String(i.properties[id]))) &&
      (!q || i.title.toLowerCase().includes(q) || i.key.toLowerCase().includes(q)),
  );
}
