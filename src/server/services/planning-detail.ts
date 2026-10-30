import { and, asc, eq, exists, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { issue, issueModule, issueRelation, state } from "@/db/schema";
import type { PlanningKind } from "@/lib/planning-navigation";
import { listCycles, listMilestones, listModules } from "./planning";

/** Read-only drill-down. Keep progress and blocker semantics identical to the existing planning and next_work views. */
export async function getPlanningDetail(projectId: string, kind: PlanningKind, id: string) {
  const loaders = { milestone: listMilestones, module: listModules, cycle: listCycles };
  const item = (await loaders[kind](projectId)).find((row) => row.id === id);
  if (!item) return null;
  const db = await getDb();
  const membership = kind === "module"
    ? exists(db.select({ id: issueModule.issueId }).from(issueModule)
        .where(and(eq(issueModule.issueId, issue.id), eq(issueModule.moduleId, id))))
    : eq(kind === "cycle" ? issue.cycleId : issue.milestoneId, id);
  const rows = await db.query.issue.findMany({
    where: and(eq(issue.projectId, projectId), isNull(issue.archivedAt), membership),
    columns: { id: true, seq: true, title: true, type: true, parentId: true },
    with: { state: true, parent: { columns: { seq: true, title: true } } },
    orderBy: [asc(issue.sortOrder), asc(issue.seq)],
  });
  const blockers = rows.length ? await db
    .select({ targetId: issueRelation.relatedIssueId, id: issue.id, seq: issue.seq, title: issue.title })
    .from(issueRelation)
    .innerJoin(issue, eq(issue.id, issueRelation.issueId))
    .innerJoin(state, eq(state.id, issue.stateId))
    .where(and(
      eq(issueRelation.type, "blocks"),
      eq(issue.projectId, projectId),
      inArray(issueRelation.relatedIssueId, rows.map((row) => row.id)),
      inArray(state.group, ["backlog", "unstarted", "started"]),
    ))
    .orderBy(asc(issue.seq)) : [];
  return {
    item: {
      ...item,
      from: "startDate" in item ? item.startDate : null,
      to: "endDate" in item ? item.endDate : item.targetDate,
    },
    issues: rows.map((row) => ({
      ...row,
      blockers: blockers.filter((blocker) => blocker.targetId === row.id)
        .map(({ id, seq, title }) => ({ id, seq, title })),
    })),
  };
}
