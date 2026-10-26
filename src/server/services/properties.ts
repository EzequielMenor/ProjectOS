import { and, asc, eq, ilike, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Tx } from "@/db/client";
import { activity, issue, issuePropertyValue, propertyDef, PROPERTY_TYPES, type PropertyType } from "@/db/schema";
import { ServiceError, invalid, notFound } from "../errors";

export type PropValue = string | number;
/** What a client may send for a property: a value, or null/"" to clear it. */
export type PropInput = PropValue | null;

type Def = { id: string; projectId: string; name: string; type: PropertyType; options: string[] };

const nameSchema = z.string().trim().min(1).max(50);
const MAX_OPTIONS = 50;

const createInput = z.object({
  projectId: z.uuid(),
  name: nameSchema,
  type: z.enum(PROPERTY_TYPES),
  options: z.array(z.string()).max(MAX_OPTIONS).optional(),
});
const updateInput = z.object({ name: nameSchema.optional(), options: z.array(z.string()).max(MAX_OPTIONS).optional() });

const likeExact = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Trims, drops blanks and rejects duplicates (case-insensitive), keeping the first spelling. */
export function normalizeOptions(raw: string[]): string[] {
  const out: string[] = [];
  for (const o of raw.map((x) => x.trim()).filter(Boolean)) {
    if (o.length > 50) throw invalid(`La opción "${o.slice(0, 20)}…" supera los 50 caracteres`);
    if (out.some((x) => x.toLowerCase() === o.toLowerCase())) throw invalid(`La opción "${o}" está repetida`);
    out.push(o);
  }
  return out;
}

const isRealDate = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
};

/** Validates a raw value against the property's type. Returns null to mean "clear it". */
export function coerceValue(def: Pick<Def, "name" | "type" | "options">, raw: unknown): PropValue | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string" && raw.trim() === "") return null;
  const bad = (why: string) => invalid(`Propiedad "${def.name}": ${why}`);
  switch (def.type) {
    case "text": {
      if (typeof raw !== "string") throw bad("se esperaba texto");
      const v = raw.trim();
      if (v.length > 2000) throw bad("el texto supera los 2000 caracteres");
      return v;
    }
    case "number": {
      const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.trim().replace(",", ".")) : NaN;
      if (!Number.isFinite(n) || Math.abs(n) > 1e12) throw bad("se esperaba un número");
      return n;
    }
    case "date": {
      if (typeof raw !== "string" || !isRealDate(raw.trim())) throw bad("se esperaba una fecha YYYY-MM-DD válida");
      return raw.trim();
    }
    case "select": {
      const found = typeof raw === "string" ? def.options.find((o) => o.toLowerCase() === raw.trim().toLowerCase()) : undefined;
      if (!found) throw bad(`opción desconocida. Válidas: ${def.options.join(", ")}`);
      return found;
    }
  }
}

export async function listPropertyDefs(projectId: string): Promise<Def[]> {
  const db = await getDb();
  return db.select().from(propertyDef).where(eq(propertyDef.projectId, projectId)).orderBy(asc(propertyDef.position), asc(propertyDef.createdAt));
}

async function mustGet(tx: Pick<Tx, "query">, id: string) {
  const d = await tx.query.propertyDef.findFirst({ where: eq(propertyDef.id, id) });
  if (!d) throw notFound("Propiedad");
  return d;
}

async function assertNameFree(tx: Pick<Tx, "query">, projectId: string, name: string, exceptId?: string) {
  const dup = await tx.query.propertyDef.findFirst({
    where: and(eq(propertyDef.projectId, projectId), ilike(propertyDef.name, likeExact(name)), exceptId ? ne(propertyDef.id, exceptId) : undefined),
  });
  if (dup) throw new ServiceError("conflict", `Ya existe una propiedad "${dup.name}" en este proyecto`);
}

export async function createPropertyDef(raw: unknown, actor = "user") {
  const input = createInput.parse(raw);
  const options = input.type === "select" ? normalizeOptions(input.options ?? []) : [];
  if (input.type === "select" && !options.length) throw invalid("Una propiedad de selección necesita al menos una opción");
  if (input.type !== "select" && input.options?.length) throw invalid("Solo las propiedades de selección tienen opciones");
  const db = await getDb();
  return db.transaction(async (tx) => {
    await assertNameFree(tx, input.projectId, input.name);
    const [last] = await tx.select({ max: sql<number>`coalesce(max(${propertyDef.position}), 0)` }).from(propertyDef).where(eq(propertyDef.projectId, input.projectId));
    const [created] = await tx.insert(propertyDef).values({ projectId: input.projectId, name: input.name, type: input.type, options, position: Number(last.max) + 1 }).returning();
    await tx.insert(activity).values({ projectId: input.projectId, actor, action: "property.created", data: { propertyId: created.id, name: created.name, type: created.type } });
    return created;
  });
}

/**
 * Renames a property and/or replaces a select's options. An option that issues still use cannot be removed:
 * that would silently erase their values, so the caller must clear or change those values first.
 */
export async function updatePropertyDef(id: string, raw: unknown, actor = "user") {
  const input = updateInput.parse(raw);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const before = await mustGet(tx, id);
    const patch: Partial<{ name: string; options: string[] }> = {};
    if (input.name && input.name !== before.name) {
      await assertNameFree(tx, before.projectId, input.name, id);
      patch.name = input.name;
    }
    if (input.options) {
      if (before.type !== "select") throw invalid("Solo las propiedades de selección tienen opciones");
      const options = normalizeOptions(input.options);
      if (!options.length) throw invalid("Una propiedad de selección necesita al menos una opción");
      const removed = before.options.filter((o) => !options.some((x) => x === o));
      if (removed.length) {
        const inUse = await tx
          .select({ value: issuePropertyValue.value, n: sql<number>`count(*)` })
          .from(issuePropertyValue)
          .where(and(eq(issuePropertyValue.propertyId, id), inArray(sql`${issuePropertyValue.value} #>> '{}'`, removed)))
          .groupBy(issuePropertyValue.value);
        if (inUse.length) {
          const list = inUse.map((r) => `"${String(r.value)}" (${Number(r.n)})`).join(", ");
          throw new ServiceError("conflict", `No se pueden quitar opciones en uso: ${list}. Cambia primero esos valores.`);
        }
      }
      if (options.join("\u0000") !== before.options.join("\u0000")) patch.options = options;
    }
    if (!Object.keys(patch).length) return before;
    const [updated] = await tx.update(propertyDef).set(patch).where(eq(propertyDef.id, id)).returning();
    await tx.insert(activity).values({ projectId: before.projectId, actor, action: "property.updated", data: { propertyId: id, from: { name: before.name, options: before.options }, to: patch } });
    return updated;
  });
}

/** Human-only (no agent tool). Removes the definition and every value set with it, so the count is reported and logged. */
export async function deletePropertyDef(id: string, actor = "user") {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const d = await mustGet(tx, id);
    const [{ n }] = await tx.select({ n: sql<number>`count(*)` }).from(issuePropertyValue).where(eq(issuePropertyValue.propertyId, id));
    await tx.delete(propertyDef).where(eq(propertyDef.id, id));
    await tx.insert(activity).values({ projectId: d.projectId, actor, action: "property.deleted", data: { name: d.name, type: d.type, valuesRemoved: Number(n) } });
    return { valuesRemoved: Number(n) };
  });
}

/** Number of issues with a value, per property, so settings can say what a deletion would erase. */
export async function propertyUsage(projectId: string) {
  const db = await getDb();
  const rows = await db
    .select({ propertyId: issuePropertyValue.propertyId, n: sql<number>`count(*)` })
    .from(issuePropertyValue)
    .innerJoin(propertyDef, eq(propertyDef.id, issuePropertyValue.propertyId))
    .where(eq(propertyDef.projectId, projectId))
    .groupBy(issuePropertyValue.propertyId);
  return Object.fromEntries(rows.map((r) => [r.propertyId, Number(r.n)])) as Record<string, number>;
}

/** Names → ids for agents. Unknown names fail with the list of valid ones. */
export async function resolvePropertyInputs(projectId: string, byName: Record<string, PropInput>): Promise<Record<string, PropInput>> {
  const defs = await listPropertyDefs(projectId);
  const out: Record<string, PropInput> = {};
  for (const [name, v] of Object.entries(byName)) {
    const d = defs.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
    if (!d) throw invalid(`Propiedad desconocida "${name}". Válidas: ${defs.map((x) => x.name).join(", ") || "(ninguna)"}`);
    out[d.id] = v;
  }
  return out;
}

/**
 * Sets (or clears, with null) values for an issue inside the caller's transaction. Keys are property ids.
 * Returns the changes keyed `property:<name>` for the activity log; unchanged values are skipped.
 */
export async function applyPropertyValues(tx: Tx, issueId: string, projectId: string, values: Record<string, unknown>) {
  const ids = Object.keys(values);
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (!ids.length) return changes;
  const defs = await tx.query.propertyDef.findMany({ where: inArray(propertyDef.id, ids) });
  for (const id of ids) {
    const d = defs.find((x) => x.id === id);
    if (!d || d.projectId !== projectId) throw invalid("Alguna propiedad no pertenece al proyecto del issue");
  }
  const current = await tx.query.issuePropertyValue.findMany({ where: and(eq(issuePropertyValue.issueId, issueId), inArray(issuePropertyValue.propertyId, ids)) });
  for (const d of defs) {
    const next = coerceValue(d, values[d.id]);
    const prev = current.find((c) => c.propertyId === d.id)?.value ?? null;
    if (next === prev) continue;
    if (next === null) await tx.delete(issuePropertyValue).where(and(eq(issuePropertyValue.issueId, issueId), eq(issuePropertyValue.propertyId, d.id)));
    else
      await tx
        .insert(issuePropertyValue)
        .values({ issueId, propertyId: d.id, value: next })
        .onConflictDoUpdate({ target: [issuePropertyValue.issueId, issuePropertyValue.propertyId], set: { value: next } });
    changes[`property:${d.name}`] = { from: prev, to: next };
  }
  return changes;
}

/** Same as applyPropertyValues for a standalone call (the detail panel), with its own transaction and activity entry. */
export async function setIssueProperties(issueId: string, values: Record<string, unknown>, actor = "user") {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const row = await tx.query.issue.findFirst({ where: eq(issue.id, issueId), columns: { projectId: true } });
    if (!row) throw notFound("Issue");
    const changes = await applyPropertyValues(tx, issueId, row.projectId, values);
    if (Object.keys(changes).length) await tx.insert(activity).values({ projectId: row.projectId, issueId, actor, action: "issue.updated", data: { changes } });
    return changes;
  });
}
