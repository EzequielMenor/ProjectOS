import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { member, workspace } from "@/db/schema";

const g = globalThis as unknown as { __projectosWs?: Promise<{ id: string; slug: string; name: string }> };

/** v1 is single-workspace: the default workspace and its owner member are created on first use. */
export function getDefaultWorkspace() {
  g.__projectosWs ??= (async () => {
    const db = await getDb();
    const existing = await db.query.workspace.findFirst({ where: eq(workspace.slug, "default") });
    if (existing) return existing;
    const [ws] = await db
      .insert(workspace)
      .values({ slug: "default", name: "Mi workspace" })
      .onConflictDoNothing()
      .returning();
    const created = ws ?? (await db.query.workspace.findFirst({ where: eq(workspace.slug, "default") }))!;
    const hasMember = await db.query.member.findFirst({ where: eq(member.workspaceId, created.id) });
    if (!hasMember) await db.insert(member).values({ workspaceId: created.id, name: "Yo", kind: "human" });
    return created;
  })();
  return g.__projectosWs;
}

export async function listMembers() {
  const db = await getDb();
  const ws = await getDefaultWorkspace();
  return db.query.member.findMany({ where: eq(member.workspaceId, ws.id), orderBy: member.createdAt });
}

/** Call after replacing the database contents (restore): the cached workspace row may be gone. */
export function resetWorkspaceCache() {
  g.__projectosWs = undefined;
}
