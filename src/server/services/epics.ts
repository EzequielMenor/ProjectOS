import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { issue, project, state, type StateGroup } from "@/db/schema";
import { issueKey } from "./issues";
import type { Progress } from "./planning";

const empty = (): Progress => ({ total: 0, completed: 0, started: 0, cancelled: 0 });

/** Progress of the direct, non-archived children of each given issue, by state group. Issues without children are absent. */
export async function childProgress(parentIds: string[]) {
  const out = new Map<string, Progress>();
  if (!parentIds.length) return out;
  const db = await getDb();
  const rows = await db
    .select({ parentId: issue.parentId, group: state.group, n: sql<number>`count(*)::int` })
    .from(issue)
    .innerJoin(state, eq(state.id, issue.stateId))
    .where(and(inArray(issue.parentId, parentIds), isNull(issue.archivedAt)))
    .groupBy(issue.parentId, state.group);
  for (const r of rows) {
    const p = out.get(r.parentId!) ?? empty();
    p.total += r.n;
    if (r.group === "completed") p.completed += r.n;
    else if (r.group === "started") p.started += r.n;
    else if (r.group === "cancelled") p.cancelled += r.n;
    out.set(r.parentId!, p);
  }
  return out;
}

export type EpicRow = {
  id: string;
  key: string;
  title: string;
  priority: string;
  dueDate: string | null;
  state: { name: string; group: StateGroup; color: string };
  progress: Progress;
  children: { id: string; key: string; title: string; stateGroup: StateGroup; stateColor: string }[];
};

/** Epics of a project (archived ones excluded), oldest first, with progress computed from their sub-issues. */
export async function listEpics(projectId: string): Promise<EpicRow[]> {
  const db = await getDb();
  const proj = await db.query.project.findFirst({ where: eq(project.id, projectId) });
  if (!proj) return [];
  const epics = await db.query.issue.findMany({
    where: and(eq(issue.projectId, projectId), eq(issue.type, "epic"), isNull(issue.archivedAt)),
    with: { state: true, children: { with: { state: true }, where: isNull(issue.archivedAt), orderBy: asc(issue.seq) } },
    orderBy: asc(issue.seq),
  });
  const progress = await childProgress(epics.map((e) => e.id));
  return epics.map((e) => ({
    id: e.id,
    key: issueKey(proj.identifier, e.seq),
    title: e.title,
    priority: e.priority,
    dueDate: e.dueDate,
    state: { name: e.state.name, group: e.state.group, color: e.state.color },
    progress: progress.get(e.id) ?? empty(),
    children: e.children.map((c) => ({ id: c.id, key: issueKey(proj.identifier, c.seq), title: c.title, stateGroup: c.state.group, stateColor: c.state.color })),
  }));
}
