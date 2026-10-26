import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { activity, cycle, issue, issueModule, milestone, module, MODULE_STATUSES, state, type StateGroup } from "@/db/schema";
import { ServiceError, invalid, notFound } from "../errors";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha YYYY-MM-DD");
const name = z.string().trim().min(1).max(120);

export const createCycleInput = z.object({
  projectId: z.uuid(),
  name,
  description: z.string().max(20_000).optional(),
  startDate: dateSchema.nullish(),
  endDate: dateSchema.nullish(),
});
export const createModuleInput = z.object({
  projectId: z.uuid(),
  name,
  description: z.string().max(20_000).optional(),
  status: z.enum(MODULE_STATUSES).optional(),
  startDate: dateSchema.nullish(),
  targetDate: dateSchema.nullish(),
});
export const createMilestoneInput = z.object({
  projectId: z.uuid(),
  name,
  description: z.string().max(20_000).optional(),
  targetDate: dateSchema.nullish(),
});
export const assignInput = z.object({
  cycleId: z.uuid().nullable().optional(),
  milestoneId: z.uuid().nullable().optional(),
  moduleIds: z.array(z.uuid()).max(50).optional(),
});

export type Progress = { total: number; completed: number; started: number; cancelled: number };
const empty = (): Progress => ({ total: 0, completed: 0, started: 0, cancelled: 0 });

function addTo(p: Progress, group: StateGroup, n: number) {
  p.total += n;
  if (group === "completed") p.completed += n;
  else if (group === "started") p.started += n;
  else if (group === "cancelled") p.cancelled += n;
}

/** Issue counts by state group for each cycle/milestone/module id of a project (archived issues excluded). */
async function progressBy(kind: "cycle" | "milestone" | "module", projectId: string) {
  const db = await getDb();
  const out = new Map<string, Progress>();
  const rows =
    kind === "module"
      ? await db
          .select({ key: issueModule.moduleId, group: state.group, n: sql<number>`count(*)::int` })
          .from(issueModule)
          .innerJoin(issue, eq(issue.id, issueModule.issueId))
          .innerJoin(state, eq(state.id, issue.stateId))
          .where(and(eq(issue.projectId, projectId), sql`${issue.archivedAt} is null`))
          .groupBy(issueModule.moduleId, state.group)
      : await db
          .select({ key: kind === "cycle" ? issue.cycleId : issue.milestoneId, group: state.group, n: sql<number>`count(*)::int` })
          .from(issue)
          .innerJoin(state, eq(state.id, issue.stateId))
          .where(and(eq(issue.projectId, projectId), sql`${issue.archivedAt} is null`))
          .groupBy(kind === "cycle" ? issue.cycleId : issue.milestoneId, state.group);
  for (const r of rows) {
    if (!r.key) continue;
    const p = out.get(r.key) ?? empty();
    addTo(p, r.group, r.n);
    out.set(r.key, p);
  }
  return out;
}

function checkRange(start?: string | null, end?: string | null) {
  if (start && end && end < start) throw invalid("La fecha final no puede ser anterior a la inicial");
}

async function dupGuard<T>(fn: () => Promise<T>, what: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (/unique|duplicate/i.test(String((e as Error).message) + String((e as { cause?: Error }).cause?.message))) {
      throw new ServiceError("conflict", `Ya existe ${what} con ese nombre en el proyecto`);
    }
    throw e;
  }
}

export async function listCycles(projectId: string) {
  const db = await getDb();
  const [rows, prog] = await Promise.all([
    db.select().from(cycle).where(eq(cycle.projectId, projectId)).orderBy(asc(cycle.startDate), asc(cycle.createdAt)),
    progressBy("cycle", projectId),
  ]);
  return rows.map((c) => ({ ...c, progress: prog.get(c.id) ?? empty() }));
}

export async function createCycle(raw: unknown) {
  const i = createCycleInput.parse(raw);
  checkRange(i.startDate, i.endDate);
  const db = await getDb();
  const [row] = await dupGuard(() => db.insert(cycle).values({ ...i, description: i.description ?? "" }).returning(), "un ciclo");
  return row;
}

export async function listModules(projectId: string) {
  const db = await getDb();
  const [rows, prog] = await Promise.all([
    db.select().from(module).where(eq(module.projectId, projectId)).orderBy(asc(module.name)),
    progressBy("module", projectId),
  ]);
  return rows.map((m) => ({ ...m, progress: prog.get(m.id) ?? empty() }));
}

export async function createModule(raw: unknown) {
  const i = createModuleInput.parse(raw);
  checkRange(i.startDate, i.targetDate);
  const db = await getDb();
  const [row] = await dupGuard(() => db.insert(module).values({ ...i, description: i.description ?? "" }).returning(), "un módulo");
  return row;
}

export async function listMilestones(projectId: string) {
  const db = await getDb();
  const [rows, prog] = await Promise.all([
    db.select().from(milestone).where(eq(milestone.projectId, projectId)).orderBy(asc(milestone.targetDate), asc(milestone.name)),
    progressBy("milestone", projectId),
  ]);
  return rows.map((m) => ({ ...m, progress: prog.get(m.id) ?? empty() }));
}

export async function createMilestone(raw: unknown) {
  const i = createMilestoneInput.parse(raw);
  const db = await getDb();
  const [row] = await dupGuard(() => db.insert(milestone).values({ ...i, description: i.description ?? "" }).returning(), "un hito");
  return row;
}

/** Sets an issue's cycle / milestone / modules. Everything must belong to the issue's project. Omitted fields are unchanged. */
export async function assignIssue(issueId: string, raw: unknown, actor = "user") {
  const input = assignInput.parse(raw);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const row = await tx.query.issue.findFirst({ where: eq(issue.id, issueId) });
    if (!row) throw notFound("Issue");
    const changes: Record<string, unknown> = {};
    const patch: { cycleId?: string | null; milestoneId?: string | null } = {};
    if (input.cycleId !== undefined) {
      if (input.cycleId && !(await tx.query.cycle.findFirst({ where: and(eq(cycle.id, input.cycleId), eq(cycle.projectId, row.projectId)) }))) throw invalid("El ciclo no pertenece al proyecto");
      patch.cycleId = input.cycleId;
      changes.cycle = { from: row.cycleId, to: input.cycleId };
    }
    if (input.milestoneId !== undefined) {
      if (input.milestoneId && !(await tx.query.milestone.findFirst({ where: and(eq(milestone.id, input.milestoneId), eq(milestone.projectId, row.projectId)) }))) throw invalid("El hito no pertenece al proyecto");
      patch.milestoneId = input.milestoneId;
      changes.milestone = { from: row.milestoneId, to: input.milestoneId };
    }
    if (Object.keys(patch).length) await tx.update(issue).set({ ...patch, updatedAt: new Date() }).where(eq(issue.id, issueId));
    if (input.moduleIds) {
      const ids = [...new Set(input.moduleIds)];
      if (ids.length) {
        const ok = await tx.query.module.findMany({ where: and(inArray(module.id, ids), eq(module.projectId, row.projectId)), columns: { id: true } });
        if (ok.length !== ids.length) throw invalid("Algún módulo no pertenece al proyecto");
      }
      await tx.delete(issueModule).where(eq(issueModule.issueId, issueId));
      if (ids.length) await tx.insert(issueModule).values(ids.map((moduleId) => ({ issueId, moduleId })));
      changes.modules = { to: ids };
    }
    if (Object.keys(changes).length) {
      await tx.insert(activity).values({ projectId: row.projectId, issueId, actor, action: "issue.planned", data: { changes } });
    }
    return { ok: true };
  });
}
