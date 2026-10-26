import { and, asc, eq, ilike, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { activity, issue, state, STATE_GROUPS } from "@/db/schema";
import { ServiceError, notFound } from "../errors";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const name = z.string().trim().min(1).max(50);

const createStateInput = z.object({ projectId: z.uuid(), name, group: z.enum(STATE_GROUPS), color });
const updateStateInput = z.object({ name: name.optional(), group: z.enum(STATE_GROUPS).optional(), color: color.optional() });

const likeExact = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0];

async function mustGet(tx: Tx, id: string) {
  const s = await tx.query.state.findFirst({ where: eq(state.id, id) });
  if (!s) throw notFound("Estado");
  return s;
}

async function assertNameFree(tx: Tx, projectId: string, n: string, exceptId?: string) {
  const dup = await tx.query.state.findFirst({
    where: and(eq(state.projectId, projectId), ilike(state.name, likeExact(n)), exceptId ? ne(state.id, exceptId) : undefined),
  });
  if (dup) throw new ServiceError("conflict", `Ya existe un estado "${dup.name}" en este proyecto`);
}

/** complete_issue and the board need somewhere to finish work, so a project always keeps a 'completed' state. */
async function assertStillHasCompleted(tx: Tx, projectId: string, leaving: string) {
  const left = await tx.query.state.findFirst({ where: and(eq(state.projectId, projectId), eq(state.group, "completed"), ne(state.id, leaving)) });
  if (!left) throw new ServiceError("invalid", "El proyecto debe conservar al menos un estado de tipo 'completed'");
}

export async function createState(raw: unknown, actor = "user") {
  const input = createStateInput.parse(raw);
  const db = await getDb();
  return db.transaction(async (tx) => {
    await assertNameFree(tx, input.projectId, input.name);
    const [last] = await tx.select({ max: sql<number>`coalesce(max(${state.position}), 0)` }).from(state).where(eq(state.projectId, input.projectId));
    const [created] = await tx.insert(state).values({ ...input, position: Number(last.max) + 1 }).returning();
    await tx.insert(activity).values({ projectId: input.projectId, actor, action: "state.created", data: { stateId: created.id, name: created.name, group: created.group } });
    return created;
  });
}

export async function updateState(id: string, raw: unknown, actor = "user") {
  const input = updateStateInput.parse(raw);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const before = await mustGet(tx, id);
    if (input.name && input.name !== before.name) await assertNameFree(tx, before.projectId, input.name, id);
    const groupChanged = input.group && input.group !== before.group;
    if (groupChanged && before.group === "completed") await assertStillHasCompleted(tx, before.projectId, id);
    const [updated] = await tx.update(state).set(input).where(eq(state.id, id)).returning();
    if (groupChanged) {
      // keep completedAt consistent with the group the issues are now in
      if (input.group === "completed") await tx.update(issue).set({ completedAt: new Date() }).where(and(eq(issue.stateId, id), isNull(issue.completedAt)));
      else if (before.group === "completed") await tx.update(issue).set({ completedAt: null }).where(eq(issue.stateId, id));
    }
    await tx.insert(activity).values({ projectId: before.projectId, actor, action: "state.updated", data: { stateId: id, from: { name: before.name, group: before.group, color: before.color }, to: input } });
    return updated;
  });
}

/** Swaps places with the neighbouring state; a no-op at the ends. */
export async function moveState(id: string, direction: "up" | "down", actor = "user") {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const me = await mustGet(tx, id);
    const all = await tx.query.state.findMany({ where: eq(state.projectId, me.projectId), orderBy: asc(state.position) });
    const i = all.findIndex((s) => s.id === id);
    const other = all[direction === "up" ? i - 1 : i + 1];
    if (!other) return me;
    // positions may tie after imports, so renumber the whole list instead of swapping two values
    const order = all.map((s) => s.id);
    [order[i], order[order.indexOf(other.id)]] = [other.id, id];
    for (const [pos, sid] of order.entries()) await tx.update(state).set({ position: pos }).where(eq(state.id, sid));
    await tx.insert(activity).values({ projectId: me.projectId, actor, action: "state.moved", data: { stateId: id, direction } });
    return { ...me, position: order.indexOf(id) };
  });
}

export async function setDefaultState(id: string, actor = "user") {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const s = await mustGet(tx, id);
    await tx.update(state).set({ isDefault: 0 }).where(eq(state.projectId, s.projectId));
    await tx.update(state).set({ isDefault: 1 }).where(eq(state.id, id));
    await tx.insert(activity).values({ projectId: s.projectId, actor, action: "state.default", data: { stateId: id, name: s.name } });
    return { ...s, isDefault: 1 };
  });
}

/**
 * Deleting is a human-only action (there is no agent tool for it). The issues in the state must go somewhere,
 * so the target is mandatory; the default state and the last 'completed' state cannot be deleted.
 */
export async function deleteState(id: string, raw: { moveIssuesTo: string }, actor = "user") {
  const { moveIssuesTo } = z.object({ moveIssuesTo: z.uuid() }).parse(raw);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const s = await mustGet(tx, id);
    if (moveIssuesTo === id) throw new ServiceError("invalid", "El estado de destino debe ser otro");
    const target = await mustGet(tx, moveIssuesTo);
    if (target.projectId !== s.projectId) throw new ServiceError("invalid", "El estado de destino es de otro proyecto");
    if (s.isDefault) throw new ServiceError("invalid", "No se puede borrar el estado por defecto; elige otro por defecto antes");
    if (s.group === "completed") await assertStillHasCompleted(tx, s.projectId, id);
    const moved = await tx
      .update(issue)
      .set({ stateId: target.id, completedAt: target.group === "completed" ? sql`coalesce(${issue.completedAt}, now())` : null })
      .where(eq(issue.stateId, id))
      .returning({ id: issue.id });
    await tx.delete(state).where(eq(state.id, id));
    await tx.insert(activity).values({
      projectId: s.projectId,
      actor,
      action: "state.deleted",
      data: { name: s.name, group: s.group, movedIssues: moved.length, movedTo: target.name },
    });
    return { moved: moved.length };
  });
}

/** Issue count per state, so the settings page can say what a deletion would move. */
export async function stateIssueCounts(projectId: string) {
  const db = await getDb();
  const rows = await db
    .select({ stateId: issue.stateId, n: sql<number>`count(*)` })
    .from(issue)
    .where(eq(issue.projectId, projectId))
    .groupBy(issue.stateId);
  return Object.fromEntries(rows.map((r) => [r.stateId, Number(r.n)])) as Record<string, number>;
}
