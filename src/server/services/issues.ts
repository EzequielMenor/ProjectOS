import { and, asc, desc, eq, exists, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { getDb, type Tx } from "@/db/client";
import {
  activity,
  comment,
  issue,
  issueLabel,
  issueLink,
  issueRelation,
  project,
  state,
} from "@/db/schema";
import { ServiceError, invalid, notFound } from "../errors";
import {
  addCommentInput,
  addLinkInput,
  addRelationInput,
  createIssueInput,
  listIssuesInput,
  moveIssueInput,
  updateIssueInput,
} from "../schemas";

const issueWith = {
  state: true,
  assignee: true,
  labels: { with: { label: true } },
  cycle: { columns: { name: true } },
  milestone: { columns: { name: true } },
  modules: { with: { module: { columns: { name: true } } } },
} as const;

export const issueKey = (identifier: string, seq: number) => `${identifier}-${seq}`;

export function parseIssueKey(key: string) {
  const m = /^([A-Za-z][A-Za-z0-9]{1,9})-(\d+)$/.exec(key.trim());
  return m ? { identifier: m[1].toUpperCase(), seq: Number(m[2]) } : null;
}

async function findIssueRow(tx: Pick<Tx, "query">, id: string) {
  const row = await tx.query.issue.findFirst({ where: eq(issue.id, id) });
  if (!row) throw notFound("Issue");
  return row;
}

async function assertStateInProject(tx: Pick<Tx, "query">, stateId: string, projectId: string) {
  const s = await tx.query.state.findFirst({ where: and(eq(state.id, stateId), eq(state.projectId, projectId)) });
  if (!s) throw invalid("El estado no pertenece al proyecto");
  return s;
}

async function assertParent(tx: Pick<Tx, "query">, parentId: string, projectId: string, selfId?: string) {
  if (parentId === selfId) throw invalid("Un issue no puede ser su propio padre");
  const parent = await tx.query.issue.findFirst({ where: eq(issue.id, parentId) });
  if (!parent || parent.projectId !== projectId) throw invalid("El padre debe existir en el mismo proyecto");
  // prevent cycles: walk up from the proposed parent
  let cursor: string | null = parent.parentId;
  for (let i = 0; cursor && i < 100; i++) {
    if (cursor === selfId) throw invalid("La jerarquía formaría un ciclo");
    const up: { parentId: string | null } | undefined = await tx.query.issue.findFirst({
      where: eq(issue.id, cursor),
      columns: { parentId: true },
    });
    cursor = up?.parentId ?? null;
  }
}

async function setLabels(tx: Tx, issueId: string, projectId: string, labelIds: string[]) {
  await tx.delete(issueLabel).where(eq(issueLabel.issueId, issueId));
  if (!labelIds.length) return;
  const { label } = await import("@/db/schema");
  const valid = await tx.query.label.findMany({
    where: and(inArray(label.id, labelIds), eq(label.projectId, projectId)),
    columns: { id: true },
  });
  if (valid.length !== new Set(labelIds).size) throw invalid("Alguna etiqueta no pertenece al proyecto");
  await tx.insert(issueLabel).values(valid.map((l) => ({ issueId, labelId: l.id })));
}

export async function getIssue(id: string) {
  const db = await getDb();
  const row = await db.query.issue.findFirst({
    where: eq(issue.id, id),
    with: {
      ...issueWith,
      project: true,
      parent: { columns: { id: true, seq: true, title: true, projectId: true } },
      children: { with: { state: true }, orderBy: asc(issue.sortOrder) },
      comments: { orderBy: asc(comment.createdAt) },
      links: { orderBy: asc(issueLink.createdAt) },
    },
  });
  if (!row) throw notFound("Issue");
  return row;
}

export async function getIssueByKey(key: string) {
  const parsed = parseIssueKey(key);
  if (!parsed) throw invalid(`Identificador inválido: ${key}`);
  const db = await getDb();
  const [found] = await db
    .select({ id: issue.id })
    .from(issue)
    .innerJoin(project, eq(project.id, issue.projectId))
    .where(and(eq(project.identifier, parsed.identifier), eq(issue.seq, parsed.seq)))
    .limit(1);
  if (!found) throw notFound(`Issue ${key}`);
  return getIssue(found.id);
}

export async function listIssues(raw: unknown = {}) {
  const f = listIssuesInput.parse(raw);
  const db = await getDb();
  const conds: (SQL | undefined)[] = [
    f.projectId ? eq(issue.projectId, f.projectId) : undefined,
    f.stateId ? eq(issue.stateId, f.stateId) : undefined,
    f.priority ? eq(issue.priority, f.priority) : undefined,
    f.assigneeId ? eq(issue.assigneeId, f.assigneeId) : undefined,
    f.parentId ? eq(issue.parentId, f.parentId) : undefined,
    f.type ? eq(issue.type, f.type) : undefined,
    f.includeArchived ? undefined : isNull(issue.archivedAt),
    f.stateGroup
      ? exists(
          db.select({ x: sql`1` }).from(state).where(and(eq(state.id, issue.stateId), eq(state.group, f.stateGroup))),
        )
      : undefined,
    f.labelId
      ? exists(
          db
            .select({ x: sql`1` })
            .from(issueLabel)
            .where(and(eq(issueLabel.issueId, issue.id), eq(issueLabel.labelId, f.labelId))),
        )
      : undefined,
    f.query
      ? or(ilike(issue.title, `%${f.query}%`), ilike(issue.description, `%${f.query}%`))
      : undefined,
  ];
  return db.query.issue.findMany({
    where: and(...conds),
    with: { ...issueWith, project: { columns: { identifier: true } } },
    orderBy: [asc(issue.sortOrder), desc(issue.createdAt)],
    limit: f.limit ?? 500,
  });
}

export async function createIssue(raw: unknown, actor = "user") {
  const input = createIssueInput.parse(raw);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [counter] = await tx
      .update(project)
      .set({ issueCounter: sql`${project.issueCounter} + 1`, updatedAt: new Date() })
      .where(eq(project.id, input.projectId))
      .returning({ seq: project.issueCounter, identifier: project.identifier });
    if (!counter) throw notFound("Proyecto");

    let stateId = input.stateId;
    if (stateId) await assertStateInProject(tx, stateId, input.projectId);
    else {
      const def = await tx.query.state.findFirst({
        where: and(eq(state.projectId, input.projectId), eq(state.isDefault, 1)),
      });
      const first = def ?? (await tx.query.state.findFirst({ where: eq(state.projectId, input.projectId), orderBy: asc(state.position) }));
      if (!first) throw invalid("El proyecto no tiene estados");
      stateId = first.id;
    }
    if (input.parentId) await assertParent(tx, input.parentId, input.projectId);

    // new issues go to the top of their column
    const [{ min }] = await tx
      .select({ min: sql<number | null>`min(${issue.sortOrder})` })
      .from(issue)
      .where(eq(issue.projectId, input.projectId));

    const [created] = await tx
      .insert(issue)
      .values({
        projectId: input.projectId,
        seq: counter.seq,
        type: input.type ?? "issue",
        title: input.title,
        description: input.description ?? "",
        stateId,
        priority: input.priority ?? "none",
        parentId: input.parentId ?? null,
        assigneeId: input.assigneeId ?? null,
        estimate: input.estimate ?? null,
        startDate: input.startDate ?? null,
        dueDate: input.dueDate ?? null,
        sortOrder: (min ?? 0) - 1000,
        createdBy: actor,
      })
      .returning();
    if (input.labelIds?.length) await setLabels(tx, created.id, input.projectId, input.labelIds);
    await tx.insert(activity).values({
      projectId: input.projectId,
      issueId: created.id,
      actor,
      action: "issue.created",
      data: { key: issueKey(counter.identifier, created.seq), title: created.title },
    });
    return created;
  });
}

export async function updateIssue(id: string, raw: unknown, actor = "user") {
  const input = updateIssueInput.parse(raw);
  const { labelIds, ...fields } = input;
  const db = await getDb();
  return db.transaction(async (tx) => {
    const before = await findIssueRow(tx, id);
    const patch: Record<string, unknown> = { ...fields };
    if (fields.stateId && fields.stateId !== before.stateId) {
      const s = await assertStateInProject(tx, fields.stateId, before.projectId);
      patch.completedAt = s.group === "completed" ? new Date() : null;
    }
    if (fields.parentId) await assertParent(tx, fields.parentId, before.projectId, id);

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const [k, v] of Object.entries(fields)) {
      const prev = (before as Record<string, unknown>)[k];
      if (v !== undefined && prev !== v) changes[k] = { from: prev, to: v };
    }
    if (labelIds) {
      await setLabels(tx, id, before.projectId, labelIds);
      changes.labels = { from: null, to: labelIds };
    }
    if (!Object.keys(changes).length) return before;

    const [updated] = await tx
      .update(issue)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(issue.id, id))
      .returning();
    await tx.insert(activity).values({
      projectId: before.projectId,
      issueId: id,
      actor,
      action: "issue.updated",
      data: { changes },
    });
    return updated;
  });
}

/** Moves an issue to a state and positions it between two neighbours (fractional indexing). */
export async function moveIssue(id: string, raw: unknown, actor = "user") {
  const input = moveIssueInput.parse(raw);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const before = await findIssueRow(tx, id);
    const target = await assertStateInProject(tx, input.stateId, before.projectId);
    const [prev, next] = await Promise.all([
      input.prevId ? tx.query.issue.findFirst({ where: eq(issue.id, input.prevId), columns: { sortOrder: true } }) : undefined,
      input.nextId ? tx.query.issue.findFirst({ where: eq(issue.id, input.nextId), columns: { sortOrder: true } }) : undefined,
    ]);
    const sortOrder =
      prev && next ? (prev.sortOrder + next.sortOrder) / 2
      : prev ? prev.sortOrder + 1000
      : next ? next.sortOrder - 1000
      : 0;
    const [updated] = await tx
      .update(issue)
      .set({
        stateId: input.stateId,
        sortOrder,
        completedAt: target.group === "completed" ? (before.completedAt ?? new Date()) : null,
        updatedAt: new Date(),
      })
      .where(eq(issue.id, id))
      .returning();
    if (before.stateId !== input.stateId) {
      await tx.insert(activity).values({
        projectId: before.projectId,
        issueId: id,
        actor,
        action: "issue.updated",
        data: { changes: { stateId: { from: before.stateId, to: input.stateId } } },
      });
    }
    return updated;
  });
}

/** Archive is reversible. Issues are never hard-deleted through the service layer. */
export async function setIssueArchived(id: string, archived: boolean, actor = "user") {
  const db = await getDb();
  const row = await findIssueRow(db, id);
  const [updated] = await db
    .update(issue)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(eq(issue.id, id))
    .returning();
  await db.insert(activity).values({
    projectId: row.projectId,
    issueId: id,
    actor,
    action: archived ? "issue.archived" : "issue.unarchived",
  });
  return updated;
}

export async function addComment(issueId: string, raw: unknown, actor = "user") {
  const input = addCommentInput.parse(raw);
  const db = await getDb();
  const row = await findIssueRow(db, issueId);
  const [created] = await db.insert(comment).values({ issueId, actor, body: input.body }).returning();
  await db.insert(activity).values({ projectId: row.projectId, issueId, actor, action: "comment.added", data: { commentId: created.id } });
  return created;
}

export async function addLink(issueId: string, raw: unknown, actor = "user") {
  const input = addLinkInput.parse(raw);
  const db = await getDb();
  const row = await findIssueRow(db, issueId);
  const [created] = await db
    .insert(issueLink)
    .values({ issueId, actor, kind: input.kind, url: input.url, title: input.title ?? "" })
    .returning();
  await db.insert(activity).values({
    projectId: row.projectId,
    issueId,
    actor,
    action: "link.added",
    data: { kind: input.kind, url: input.url },
  });
  return created;
}

export async function addRelation(issueId: string, raw: unknown, actor = "user") {
  const input = addRelationInput.parse(raw);
  if (input.relatedIssueId === issueId) throw invalid("Un issue no puede relacionarse consigo mismo");
  const db = await getDb();
  const [a, b] = await Promise.all([findIssueRow(db, issueId), findIssueRow(db, input.relatedIssueId)]);
  if (a.projectId !== b.projectId) throw new ServiceError("invalid", "Las relaciones solo se permiten dentro del mismo proyecto");
  const [created] = await db
    .insert(issueRelation)
    .values({ issueId, relatedIssueId: input.relatedIssueId, type: input.type })
    .onConflictDoNothing()
    .returning();
  if (created)
    await db.insert(activity).values({
      projectId: a.projectId,
      issueId,
      actor,
      action: "relation.added",
      data: { relatedIssueId: input.relatedIssueId, type: input.type },
    });
  return created ?? null;
}

export async function listActivity(issueId: string) {
  const db = await getDb();
  return db.query.activity.findMany({ where: eq(activity.issueId, issueId), orderBy: asc(activity.createdAt) });
}
