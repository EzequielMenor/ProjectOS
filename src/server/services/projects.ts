import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { activity, project, state, type StateGroup } from "@/db/schema";
import { ServiceError, notFound } from "../errors";
import { createProjectInput, updateProjectInput } from "../schemas";
import { getDefaultWorkspace } from "./workspace";

const DEFAULT_STATES: { name: string; group: StateGroup; color: string; isDefault?: boolean }[] = [
  { name: "Backlog", group: "backlog", color: "#94a3b8" },
  { name: "Todo", group: "unstarted", color: "#64748b", isDefault: true },
  { name: "In Progress", group: "started", color: "#f59e0b" },
  { name: "Done", group: "completed", color: "#22c55e" },
  { name: "Cancelled", group: "cancelled", color: "#ef4444" },
];

export async function listProjects(opts: { includeArchived?: boolean } = {}) {
  const db = await getDb();
  const ws = await getDefaultWorkspace();
  return db.query.project.findMany({
    where: and(eq(project.workspaceId, ws.id), opts.includeArchived ? undefined : isNull(project.archivedAt)),
    orderBy: asc(project.createdAt),
  });
}

export async function getProjectByIdentifier(identifier: string) {
  const db = await getDb();
  const ws = await getDefaultWorkspace();
  const found = await db.query.project.findFirst({
    where: and(eq(project.workspaceId, ws.id), eq(project.identifier, identifier.toUpperCase())),
  });
  if (!found) throw notFound(`Proyecto ${identifier}`);
  return found;
}

export async function listStates(projectId: string) {
  const db = await getDb();
  return db.query.state.findMany({ where: eq(state.projectId, projectId), orderBy: asc(state.position) });
}

export async function createProject(raw: unknown, actor = "user") {
  const input = createProjectInput.parse(raw);
  const db = await getDb();
  const ws = await getDefaultWorkspace();
  const dup = await db.query.project.findFirst({
    where: and(eq(project.workspaceId, ws.id), eq(project.identifier, input.identifier)),
  });
  if (dup) throw new ServiceError("conflict", `Ya existe un proyecto ${input.identifier}`);
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(project)
      .values({
        workspaceId: ws.id,
        identifier: input.identifier,
        name: input.name,
        description: input.description ?? "",
        color: input.color,
      })
      .returning();
    await tx.insert(state).values(
      DEFAULT_STATES.map((s, i) => ({
        projectId: created.id,
        name: s.name,
        group: s.group,
        color: s.color,
        position: i * 1000,
        isDefault: s.isDefault ? 1 : 0,
      })),
    );
    await tx.insert(activity).values({ projectId: created.id, actor, action: "project.created", data: { identifier: created.identifier } });
    return created;
  });
}

export async function updateProject(id: string, raw: unknown, actor = "user") {
  const input = updateProjectInput.parse(raw);
  const db = await getDb();
  const [updated] = await db
    .update(project)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(project.id, id))
    .returning();
  if (!updated) throw notFound("Proyecto");
  await db.insert(activity).values({ projectId: id, actor, action: "project.updated", data: input });
  return updated;
}

/** Archiving is reversible; there is intentionally no delete in the service layer. */
export async function setProjectArchived(id: string, archived: boolean, actor = "user") {
  const db = await getDb();
  const [updated] = await db
    .update(project)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(eq(project.id, id))
    .returning();
  if (!updated) throw notFound("Proyecto");
  await db.insert(activity).values({ projectId: id, actor, action: archived ? "project.archived" : "project.unarchived" });
  return updated;
}
