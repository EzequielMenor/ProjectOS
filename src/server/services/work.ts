import { and, eq, inArray, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { issue, issueRelation, state, PRIORITIES } from "@/db/schema";
import { listIssues } from "./issues";

const OPEN_GROUPS = ["backlog", "unstarted", "started"];

/** Relations of an issue in both directions, with the other side's key and state. */
export async function listRelations(issueId: string) {
  const db = await getDb();
  const rows = await db.query.issueRelation.findMany({
    where: or(eq(issueRelation.issueId, issueId), eq(issueRelation.relatedIssueId, issueId)),
  });
  const otherIds = [...new Set(rows.map((r) => (r.issueId === issueId ? r.relatedIssueId : r.issueId)))];
  if (!otherIds.length) return [];
  const others = await db.query.issue.findMany({
    where: inArray(issue.id, otherIds),
    with: { state: true, project: { columns: { identifier: true } } },
  });
  const byId = new Map(others.map((o) => [o.id, o]));
  return rows.map((r) => {
    const outgoing = r.issueId === issueId;
    const o = byId.get(outgoing ? r.relatedIssueId : r.issueId)!;
    // "blocks" is directional; show the reverse as "blocked_by" from the other side.
    const type = r.type === "blocks" && !outgoing ? "blocked_by" : r.type;
    return { type, id: o.id, key: `${o.project.identifier}-${o.seq}`, title: o.title, state: o.state.name, stateGroup: o.state.group };
  });
}

/**
 * Open, unblocked issues ordered by what to do next: already started first, then priority, then board order.
 * An issue is blocked while any issue that `blocks` it is still open.
 */
export async function nextWork(opts: { projectId?: string; assigneeId?: string; limit?: number } = {}) {
  const db = await getDb();
  const all = await listIssues({ projectId: opts.projectId, assigneeId: opts.assigneeId, limit: 500 });
  const open = all.filter((i) => ["unstarted", "started"].includes(i.state.group) && i.type !== "epic");
  if (!open.length) return [];
  const blockers = await db
    .select({ blocked: issueRelation.relatedIssueId, group: state.group })
    .from(issueRelation)
    .innerJoin(issue, eq(issue.id, issueRelation.issueId))
    .innerJoin(state, eq(state.id, issue.stateId))
    .where(and(eq(issueRelation.type, "blocks"), inArray(issueRelation.relatedIssueId, open.map((i) => i.id))));
  const blocked = new Set(blockers.filter((b) => OPEN_GROUPS.includes(b.group)).map((b) => b.blocked));
  const rank = (p: (typeof PRIORITIES)[number]) => ({ urgent: 0, high: 1, medium: 2, low: 3, none: 4 })[p];
  return open
    .filter((i) => !blocked.has(i.id))
    .sort(
      (a, b) =>
        Number(b.state.group === "started") - Number(a.state.group === "started") ||
        rank(a.priority) - rank(b.priority) ||
        a.sortOrder - b.sortOrder,
    )
    .slice(0, opts.limit ?? 5);
}
