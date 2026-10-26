import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { savedView, VIEW_LAYOUTS } from "@/db/schema";
import { ServiceError, notFound } from "../errors";

export const createViewInput = z.object({
  projectId: z.uuid(),
  name: z.string().trim().min(1).max(60),
  layout: z.enum(VIEW_LAYOUTS).default("list"),
  /** Only the filter keys the filter bar understands; anything else is dropped. */
  query: z.string().max(2000).default(""),
});

const FILTER_KEYS = new Set(["state", "assignee", "priority", "label", "cycle", "module", "q"]);
/** Custom property filters travel as `p.<propertyId>=a,b`. */
const PROPERTY_KEY = /^p\.[0-9a-f-]{36}$/i;

function cleanQuery(raw: string) {
  const src = new URLSearchParams(raw.replace(/^\?/, ""));
  const out = new URLSearchParams();
  for (const [k, v] of src) if ((FILTER_KEYS.has(k) || PROPERTY_KEY.test(k)) && v) out.set(k, v);
  return out.toString();
}

export async function listViews(projectId: string) {
  const db = await getDb();
  return db.select().from(savedView).where(eq(savedView.projectId, projectId)).orderBy(asc(savedView.name));
}

/** Every project's views, for the sidebar. */
export async function listAllViews() {
  const db = await getDb();
  return db.select().from(savedView).orderBy(asc(savedView.name));
}

export async function createView(raw: unknown) {
  const input = createViewInput.parse(raw);
  const db = await getDb();
  const [row] = await db
    .insert(savedView)
    .values({ ...input, query: cleanQuery(input.query) })
    .onConflictDoNothing()
    .returning();
  if (!row) throw new ServiceError("conflict", `Ya existe una vista llamada "${input.name}"`);
  return row;
}

/** Human action only (a view is just a bookmark, but agents get no delete tools at all). */
export async function deleteView(id: string, projectId: string) {
  const db = await getDb();
  const rows = await db.delete(savedView).where(and(eq(savedView.id, id), eq(savedView.projectId, projectId))).returning({ id: savedView.id });
  if (!rows.length) throw notFound("Vista");
}
