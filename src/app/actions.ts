"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { ServiceError } from "@/server/errors";
import type { Priority, StateGroup } from "@/db/schema";
import { addComment, addRelation, createIssue, issueKey, moveIssue, removeRelation, searchIssues, setIssueArchived, updateIssue } from "@/server/services/issues";
import { ensureLabel } from "@/server/services/labels";
import { createPage, restorePageVersion, searchPages, setPageArchived, updatePage } from "@/server/services/pages";
import { createView, deleteView } from "@/server/services/views";
import { createProject, listProjects, updateProject } from "@/server/services/projects";
import { createPropertyDef, deletePropertyDef, updatePropertyDef } from "@/server/services/properties";
import { createState, deleteState, moveState, setDefaultState, updateState } from "@/server/services/states";
import { createToken, revokeToken } from "@/server/services/tokens";
import { assignIssue, createCycle, createMilestone, createModule } from "@/server/services/planning";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message };
    if (e instanceof ZodError) return { ok: false, error: e.issues.map((i) => i.message).join("; ") };
    console.error(e);
    return { ok: false, error: "Error inesperado" };
  }
}

export async function createProjectAction(input: unknown) {
  return run(async () => {
    const p = await createProject(input);
    return { identifier: p.identifier };
  });
}

export async function createIssueAction(input: unknown) {
  return run(async () => {
    const i = await createIssue(input);
    return { id: i.id, seq: i.seq };
  });
}

export async function updateIssueAction(id: string, patch: unknown) {
  return run(async () => {
    await updateIssue(id, patch);
  });
}

export async function moveIssueAction(id: string, input: unknown) {
  return run(async () => {
    await moveIssue(id, input);
  });
}

export async function archiveIssueAction(id: string, archived: boolean) {
  return run(async () => {
    await setIssueArchived(id, archived);
  });
}

export async function addCommentAction(issueId: string, input: unknown) {
  return run(async () => {
    await addComment(issueId, input);
  });
}

export async function createTokenAction(input: unknown) {
  return run(async () => {
    const t = await createToken(input);
    return { token: t.token };
  });
}

export async function revokeTokenAction(id: string) {
  return run(async () => {
    await revokeToken(id);
  });
}

export async function createPlanningAction(kind: "cycle" | "module" | "milestone", input: unknown) {
  return run(async () => {
    if (kind === "cycle") await createCycle(input);
    else if (kind === "module") await createModule(input);
    else await createMilestone(input);
  });
}

export async function assignIssueAction(issueId: string, input: unknown) {
  return run(async () => {
    await assignIssue(issueId, input);
  });
}

export async function addRelationAction(issueId: string, input: unknown) {
  return run(async () => {
    await addRelation(issueId, input);
  });
}

export async function removeRelationAction(issueId: string, input: unknown) {
  return run(async () => {
    await removeRelation(issueId, input);
  });
}

export async function createLabelAction(input: unknown) {
  return run(async () => {
    const l = await ensureLabel(input);
    return { id: l.id, name: l.name, color: l.color };
  });
}

export async function createPageAction(input: unknown) {
  return run(async () => {
    const p = await createPage(input);
    return { id: p.id };
  });
}

export async function updatePageAction(id: string, input: unknown) {
  return run(async () => {
    const p = await updatePage(id, input);
    return { updatedAt: p.updatedAt.toISOString() };
  });
}

export async function restorePageVersionAction(id: string, versionId: string) {
  return run(async () => {
    const p = await restorePageVersion(id, versionId);
    return { updatedAt: p.updatedAt.toISOString() };
  });
}

export async function archivePageAction(id: string, archived: boolean) {
  return run(async () => {
    await setPageArchived(id, archived);
  });
}

export async function createViewAction(input: unknown) {
  return run(async () => {
    const v = await createView(input);
    return { id: v.id };
  });
}

export async function deleteViewAction(id: string, projectId: string) {
  return run(async () => {
    await deleteView(id, projectId);
  });
}

export type SearchHit = {
  key: string;
  title: string;
  state: { name: string; group: StateGroup; color: string };
  priority: Priority;
};
export type PageHit = { id: string; title: string; identifier: string };

/** Read-only: no revalidation, bounded results. Backs the Ctrl+K palette. */
export async function searchAction(query: string): Promise<{ issues: SearchHit[]; pages: PageHit[] }> {
  const q = String(query ?? "").slice(0, 200);
  if (q.trim().length < 1) return { issues: [], pages: [] };
  const [rows, pages, projects] = await Promise.all([searchIssues(q, 12), searchPages(q, 6), listProjects({ includeArchived: true })]);
  const ident = new Map(projects.map((p) => [p.id, p.identifier]));
  return {
    issues: rows.map((r) => ({
      key: issueKey(r.project.identifier, r.seq),
      title: r.title,
      state: { name: r.state.name, group: r.state.group, color: r.state.color },
      priority: r.priority,
    })),
    pages: pages.map((p) => ({ id: p.id, title: p.title, identifier: ident.get(p.projectId) ?? "" })).filter((p) => p.identifier),
  };
}

export async function updateProjectAction(id: string, patch: unknown) {
  return run(async () => {
    await updateProject(id, patch);
  });
}

export async function createStateAction(input: unknown) {
  return run(async () => {
    await createState(input);
  });
}

export async function updateStateAction(id: string, patch: unknown) {
  return run(async () => {
    await updateState(id, patch);
  });
}

export async function moveStateAction(id: string, direction: "up" | "down") {
  return run(async () => {
    await moveState(id, direction);
  });
}

export async function setDefaultStateAction(id: string) {
  return run(async () => {
    await setDefaultState(id);
  });
}

export async function deleteStateAction(id: string, input: unknown) {
  return run(async () => deleteState(id, input as { moveIssuesTo: string }));
}

export async function createPropertyAction(input: unknown) {
  return run(async () => {
    await createPropertyDef(input);
  });
}
export async function updatePropertyAction(id: string, patch: unknown) {
  return run(async () => {
    await updatePropertyDef(id, patch);
  });
}
export async function deletePropertyAction(id: string) {
  return run(async () => deletePropertyDef(id));
}
