import { and, asc, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Tx } from "@/db/client";
import { activity, issue, page, pageIssueLink, pagePageLink, pageVersion, project } from "@/db/schema";
import { extractRefs, type Resolved } from "@/lib/page-links";
import { ServiceError, notFound } from "../errors";

export { extractRefs, linkify, type Resolved } from "@/lib/page-links";

export const createPageInput = z.object({
  projectId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  content: z.string().max(500_000).default(""),
});
export const updatePageInput = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().max(500_000).optional(),
  /** Optimistic concurrency: reject when the page changed since the caller read it. */
  expectedUpdatedAt: z.string().optional(),
});

async function resolve(db: Pick<Tx, "query">, projectId: string, refs: ReturnType<typeof extractRefs>): Promise<Resolved> {
  const issues: Resolved["issues"] = {};
  const byProject = new Map<string, number[]>();
  for (const k of refs.keys) {
    const [ident, seq] = k.split("-");
    byProject.set(ident, [...(byProject.get(ident) ?? []), Number(seq)]);
  }
  for (const [ident, seqs] of byProject) {
    const proj = await db.query.project.findFirst({ where: eq(project.identifier, ident) });
    if (!proj) continue;
    const rows = await db.query.issue.findMany({ where: and(eq(issue.projectId, proj.id), inArray(issue.seq, seqs)) });
    for (const r of rows) issues[`${ident}-${r.seq}`] = { id: r.id, seq: r.seq, identifier: ident, title: r.title };
  }
  const pages: Resolved["pages"] = {};
  if (refs.titles.length) {
    const proj = await db.query.project.findFirst({ where: eq(project.id, projectId) });
    const rows = await db.query.page.findMany({ where: eq(page.projectId, projectId) });
    const wanted = new Set(refs.titles.map((t) => t.toLowerCase()));
    for (const r of rows) if (wanted.has(r.title.toLowerCase())) pages[r.title.toLowerCase()] = { id: r.id, title: r.title, identifier: proj!.identifier };
  }
  return { issues, pages };
}

async function relink(tx: Tx, pageId: string, projectId: string, content: string) {
  const refs = extractRefs(content);
  const res = await resolve(tx, projectId, refs);
  await tx.delete(pageIssueLink).where(eq(pageIssueLink.pageId, pageId));
  await tx.delete(pagePageLink).where(eq(pagePageLink.pageId, pageId));
  const issueIds = [...new Set(Object.values(res.issues).map((i) => i.id))];
  if (issueIds.length) await tx.insert(pageIssueLink).values(issueIds.map((issueId) => ({ pageId, issueId })));
  const pageIds = [...new Set(Object.values(res.pages).map((p) => p.id))].filter((id) => id !== pageId);
  if (pageIds.length) await tx.insert(pagePageLink).values(pageIds.map((targetPageId) => ({ pageId, targetPageId })));
}

/** When a title appears (new page / rename), pages that already pointed to `[[title]]` gain the link. */
async function relinkMentions(tx: Tx, projectId: string, title: string, exceptId: string) {
  const esc = title.replace(/[\\%_]/g, (c) => `\\${c}`);
  const rows = await tx.query.page.findMany({ where: and(eq(page.projectId, projectId), ilike(page.content, `%[[${esc}]]%`)) });
  for (const r of rows) if (r.id !== exceptId) await relink(tx, r.id, projectId, r.content);
}

export async function createPage(raw: unknown, actor = "user") {
  const input = createPageInput.parse(raw);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const proj = await tx.query.project.findFirst({ where: eq(project.id, input.projectId) });
    if (!proj) throw notFound("Proyecto");
    const dup = await tx.query.page.findFirst({ where: and(eq(page.projectId, input.projectId), ilike(page.title, input.title.replace(/[\\%_]/g, (c) => `\\${c}`))) });
    if (dup) throw new ServiceError("conflict", `Ya existe una página "${dup.title}" en este proyecto`);
    const [created] = await tx.insert(page).values({ ...input, createdBy: actor }).returning();
    await relink(tx, created.id, input.projectId, input.content);
    await relinkMentions(tx, input.projectId, created.title, created.id);
    await tx.insert(activity).values({ projectId: input.projectId, actor, action: "page.created", data: { pageId: created.id, title: created.title } });
    return created;
  });
}

export async function updatePage(id: string, raw: unknown, actor = "user") {
  const input = updatePageInput.parse(raw);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const before = await tx.query.page.findFirst({ where: eq(page.id, id) });
    if (!before) throw notFound("Página");
    if (input.expectedUpdatedAt && new Date(input.expectedUpdatedAt).getTime() !== before.updatedAt.getTime())
      throw new ServiceError("conflict", "La página cambió desde que la leíste; vuelve a leerla antes de editar");
    const title = input.title ?? before.title;
    const content = input.content ?? before.content;
    if (title === before.title && content === before.content) return before;
    if (title.toLowerCase() !== before.title.toLowerCase()) {
      const dup = await tx.query.page.findFirst({ where: and(eq(page.projectId, before.projectId), ilike(page.title, title.replace(/[\\%_]/g, (c) => `\\${c}`))) });
      if (dup && dup.id !== id) throw new ServiceError("conflict", `Ya existe una página "${dup.title}" en este proyecto`);
    }
    await tx.insert(pageVersion).values({ pageId: id, title: before.title, content: before.content, actor });
    const [updated] = await tx.update(page).set({ title, content, updatedAt: new Date() }).where(eq(page.id, id)).returning();
    await relink(tx, id, before.projectId, content);
    if (title !== before.title) await relinkMentions(tx, before.projectId, title, id);
    await tx.insert(activity).values({ projectId: before.projectId, actor, action: "page.updated", data: { pageId: id, title } });
    return updated;
  });
}

/** Safer than replacing for agents: adds to the end and never drops existing text. */
export async function appendToPage(id: string, text: string, actor = "user") {
  const db = await getDb();
  const cur = await db.query.page.findFirst({ where: eq(page.id, id) });
  if (!cur) throw notFound("Página");
  const body = z.string().min(1).max(100_000).parse(text);
  return updatePage(id, { content: `${cur.content.replace(/\s+$/, "")}${cur.content ? "\n\n" : ""}${body}` }, actor);
}

export async function setPageArchived(id: string, archived: boolean, actor = "user") {
  const db = await getDb();
  const [row] = await db.update(page).set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() }).where(eq(page.id, id)).returning();
  if (!row) throw notFound("Página");
  await db.insert(activity).values({ projectId: row.projectId, actor, action: archived ? "page.archived" : "page.unarchived", data: { pageId: id } });
  return row;
}

export async function getPage(id: string) {
  const db = await getDb();
  if (!z.uuid().safeParse(id).success) throw notFound("Página");
  const row = await db.query.page.findFirst({ where: eq(page.id, id) });
  if (!row) throw notFound("Página");
  return row;
}

/** Resolves "FICH" + page id or exact title. */
export async function getPageByRef(identifier: string, ref: string) {
  const db = await getDb();
  const proj = await db.query.project.findFirst({ where: eq(project.identifier, identifier.toUpperCase()) });
  if (!proj) throw notFound("Proyecto");
  const row = z.uuid().safeParse(ref).success
    ? await db.query.page.findFirst({ where: and(eq(page.id, ref), eq(page.projectId, proj.id)) })
    : await db.query.page.findFirst({ where: and(eq(page.projectId, proj.id), ilike(page.title, ref.replace(/[\\%_]/g, (c) => `\\${c}`))) });
  if (!row) throw notFound("Página");
  return row;
}

export async function listPages(projectId: string, opts: { includeArchived?: boolean } = {}) {
  const db = await getDb();
  return db.query.page.findMany({
    where: and(eq(page.projectId, projectId), opts.includeArchived ? undefined : isNull(page.archivedAt)),
    orderBy: desc(page.updatedAt),
  });
}

export async function searchPages(query: string, limit = 10) {
  const q = query.trim();
  if (!q) return [];
  const esc = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  const db = await getDb();
  const rows = await db.query.page.findMany({
    where: and(isNull(page.archivedAt), or(ilike(page.title, `%${esc}%`), ilike(page.content, `%${esc}%`))),
    limit: limit * 3,
  });
  const n = q.toLowerCase();
  return rows.sort((a, b) => Number(b.title.toLowerCase().includes(n)) - Number(a.title.toLowerCase().includes(n))).slice(0, limit);
}

export async function listPageVersions(pageId: string) {
  const db = await getDb();
  return db.query.pageVersion.findMany({ where: eq(pageVersion.pageId, pageId), orderBy: desc(pageVersion.createdAt) });
}

/** Restoring writes a new version (the current text is kept in history first). */
export async function restorePageVersion(pageId: string, versionId: string, actor = "user") {
  const db = await getDb();
  const v = await db.query.pageVersion.findFirst({ where: and(eq(pageVersion.id, versionId), eq(pageVersion.pageId, pageId)) });
  if (!v) throw notFound("Versión");
  return updatePage(pageId, { title: v.title, content: v.content }, actor);
}

/** Pages that mention an issue. */
export async function pagesMentioningIssue(issueId: string) {
  const db = await getDb();
  const rows = await db
    .select({ page, identifier: project.identifier })
    .from(pageIssueLink)
    .innerJoin(page, eq(page.id, pageIssueLink.pageId))
    .innerJoin(project, eq(project.id, page.projectId))
    .where(and(eq(pageIssueLink.issueId, issueId), isNull(page.archivedAt)))
    .orderBy(asc(page.title));
  return rows.map((r) => ({ ...r.page, identifier: r.identifier }));
}

/** Outgoing and incoming links of a page. */
export async function pageLinks(pageId: string) {
  const db = await getDb();
  const [issueRows, outPages, inPages] = await Promise.all([
    db
      .select({ i: issue, identifier: project.identifier })
      .from(pageIssueLink)
      .innerJoin(issue, eq(issue.id, pageIssueLink.issueId))
      .innerJoin(project, eq(project.id, issue.projectId))
      .where(eq(pageIssueLink.pageId, pageId)),
    db.select({ p: page }).from(pagePageLink).innerJoin(page, eq(page.id, pagePageLink.targetPageId)).where(eq(pagePageLink.pageId, pageId)),
    db.select({ p: page }).from(pagePageLink).innerJoin(page, eq(page.id, pagePageLink.pageId)).where(and(eq(pagePageLink.targetPageId, pageId), isNull(page.archivedAt))),
  ]);
  return { issues: issueRows.map((r) => ({ ...r.i, identifier: r.identifier })), outgoing: outPages.map((r) => r.p), backlinks: inPages.map((r) => r.p) };
}

/** For rendering: resolve what a page's content points to. */
export async function resolveContent(projectId: string, content: string) {
  const db = await getDb();
  return resolve(db as unknown as Tx, projectId, extractRefs(content));
}
