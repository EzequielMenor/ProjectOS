import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { label } from "@/db/schema";
import { z } from "zod";

export const createLabelInput = z.object({
  projectId: z.uuid(),
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function listLabels(projectId: string) {
  const db = await getDb();
  return db.select().from(label).where(eq(label.projectId, projectId)).orderBy(asc(label.name));
}

/** Idempotent: returns the existing label when the name already exists in the project. */
export async function ensureLabel(raw: unknown) {
  const input = createLabelInput.parse(raw);
  const db = await getDb();
  const [created] = await db
    .insert(label)
    .values({ projectId: input.projectId, name: input.name, ...(input.color ? { color: input.color } : {}) })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [existing] = await db
    .select()
    .from(label)
    .where(and(eq(label.projectId, input.projectId), eq(label.name, input.name)));
  return existing;
}

export async function resolveLabelIds(projectId: string, names: string[]) {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const out: string[] = [];
  for (const name of unique) out.push((await ensureLabel({ projectId, name })).id);
  return out;
}

export async function labelsByName(projectId: string, names: string[]) {
  const db = await getDb();
  return names.length ? db.select().from(label).where(and(eq(label.projectId, projectId), inArray(label.name, names))) : [];
}
