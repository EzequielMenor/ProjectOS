"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { ServiceError } from "@/server/errors";
import { addComment, createIssue, moveIssue, setIssueArchived, updateIssue } from "@/server/services/issues";
import { createProject } from "@/server/services/projects";
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
