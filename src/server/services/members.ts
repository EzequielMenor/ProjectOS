import { and, eq, ilike, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Tx } from "@/db/client";
import { issue, member } from "@/db/schema";
import { ServiceError, invalid, notFound } from "../errors";
import { getDefaultWorkspace, listMembers } from "./workspace";

const nameSchema = z.string().trim().min(1).max(50);
const createInput = z.object({ name: nameSchema, kind: z.enum(["human", "agent"]).default("human") });
const updateInput = z.object({ name: nameSchema });

const likeExact = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Members with how many open-or-closed issues each one holds, for the settings screen. */
export async function listMembersWithCounts() {
  const db = await getDb();
  const [members, counts] = await Promise.all([
    listMembers(),
    db
      .select({ id: issue.assigneeId, n: sql<number>`count(*)::int` })
      .from(issue)
      .where(sql`${issue.assigneeId} is not null`)
      .groupBy(issue.assigneeId),
  ]);
  const byId = new Map(counts.map((c) => [c.id, c.n]));
  return members.map((m) => ({ ...m, issues: byId.get(m.id) ?? 0 }));
}

async function assertNameFree(tx: Pick<Tx, "select">, workspaceId: string, name: string, exceptId?: string) {
  const [dup] = await tx
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.workspaceId, workspaceId), ilike(member.name, likeExact(name)), exceptId ? ne(member.id, exceptId) : undefined))
    .limit(1);
  if (dup) throw new ServiceError("conflict", `Ya hay un miembro llamado "${name}"`);
}

export async function createMember(raw: unknown) {
  const input = createInput.parse(raw);
  const db = await getDb();
  const ws = await getDefaultWorkspace();
  return db.transaction(async (tx) => {
    await assertNameFree(tx, ws.id, input.name);
    const [created] = await tx.insert(member).values({ workspaceId: ws.id, name: input.name, kind: input.kind }).returning();
    return created;
  });
}

export async function updateMember(id: string, raw: unknown) {
  const input = updateInput.parse(raw);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const m = await tx.query.member.findFirst({ where: eq(member.id, id) });
    if (!m) throw notFound("Miembro");
    await assertNameFree(tx, m.workspaceId, input.name, id);
    const [updated] = await tx.update(member).set({ name: input.name }).where(eq(member.id, id)).returning();
    return updated;
  });
}

/** Human-only (no agent tool). The issues it held become unassigned; returns how many. */
export async function deleteMember(id: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const m = await tx.query.member.findFirst({ where: eq(member.id, id) });
    if (!m) throw notFound("Miembro");
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(issue).where(eq(issue.assigneeId, id));
    await tx.delete(member).where(eq(member.id, id));
    return { unassigned: n };
  });
}

/** Resolves a member by name (case-insensitive) for agents, which never see ids. */
export async function findMemberByName(name: string) {
  const wanted = name.trim().toLowerCase();
  const all = await listMembers();
  const found = all.find((m) => m.name.toLowerCase() === wanted);
  if (!found) throw invalid(`Miembro "${name}" no existe. Válidos: ${all.map((m) => m.name).join(", ") || "(ninguno)"}`);
  return found;
}

/** Throws unless the id belongs to a member, so a bad id is an `invalid` error and not a foreign-key crash. */
export async function assertMember(tx: Pick<Tx, "query">, id: string) {
  const m = await tx.query.member.findFirst({ where: eq(member.id, id), columns: { id: true, name: true } });
  if (!m) throw invalid("El miembro asignado no existe");
  return m;
}
