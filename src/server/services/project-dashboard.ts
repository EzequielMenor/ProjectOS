import { and, asc, eq, inArray, isNull, max, ne, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db/client";
import { activity, issue, issueRelation, state } from "@/db/schema";
import { listProjects } from "./projects";

/** Read-only portfolio data. Aggregate in SQL, without the issue-list pagination cap or one query per project. */
export async function listProjectDashboard() {
  const projects = await listProjects({ includeArchived: true });
  if (!projects.length) return [];
  const db = await getDb();
  const ids = projects.map((p) => p.id);
  const blocker = alias(issue, "dashboard_blocker");
  const blockerState = alias(state, "dashboard_blocker_state");
  const hasOpenBlocker = db.select({ id: blocker.id }).from(issueRelation)
    .innerJoin(blocker, eq(blocker.id, issueRelation.issueId))
    .innerJoin(blockerState, eq(blockerState.id, blocker.stateId))
    .where(and(eq(issueRelation.relatedIssueId, issue.id), eq(issueRelation.type, "blocks"),
      inArray(blockerState.group, ["backlog", "unstarted", "started"])));
  const eligible = and(inArray(issue.projectId, ids), isNull(issue.archivedAt), eq(issue.type, "issue"));
  const [progress, recent, next] = await Promise.all([
    db.select({
      projectId: issue.projectId,
      total: sql<number>`count(*)`.mapWith(Number),
      completed: sql<number>`count(*) filter (where ${state.group} = 'completed')`.mapWith(Number),
      started: sql<number>`count(*) filter (where ${state.group} = 'started')`.mapWith(Number),
    }).from(issue).innerJoin(state, eq(state.id, issue.stateId))
      .where(and(eligible, ne(state.group, "cancelled"))).groupBy(issue.projectId),
    db.select({ projectId: activity.projectId, at: max(activity.createdAt) }).from(activity)
      .where(inArray(activity.projectId, ids)).groupBy(activity.projectId),
    // Same eligibility and ordering as next_work, with a stable sequence tie-breaker.
    db.selectDistinctOn([issue.projectId], { projectId: issue.projectId, seq: issue.seq, title: issue.title })
      .from(issue).innerJoin(state, eq(state.id, issue.stateId))
      .where(and(eligible, inArray(state.group, ["started", "unstarted"]), notExists(hasOpenBlocker)))
      .orderBy(asc(issue.projectId), sql`case when ${state.group} = 'started' then 0 else 1 end`,
        sql`case ${issue.priority} when 'urgent' then 0 when 'high' then 1 when 'medium' then 2 when 'low' then 3 else 4 end`,
        asc(issue.sortOrder), asc(issue.seq)),
  ]);
  const byProgress = new Map(progress.map((p) => [p.projectId, p]));
  const byActivity = new Map(recent.map((p) => [p.projectId, p.at]));
  const byNext = new Map(next.map((p) => [p.projectId, { seq: p.seq, title: p.title }]));
  return projects.map((p) => {
    const counts = byProgress.get(p.id) ?? { total: 0, completed: 0, started: 0 };
    return {
      id: p.id, identifier: p.identifier, name: p.name, description: p.description, color: p.color,
      status: p.status, archived: p.archivedAt !== null,
      total: counts.total, completed: counts.completed, started: counts.started,
      percent: counts.total ? Math.round(counts.completed / counts.total * 100) : null,
      lastActivityAt: byActivity.get(p.id) ?? null,
      nextIssue: byNext.get(p.id) ?? null,
    };
  });
}

export type DashboardProject = Awaited<ReturnType<typeof listProjectDashboard>>[number];
