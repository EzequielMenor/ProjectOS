/* Plane → ProjectOS import. Two steps so nothing is written until the plan is validated:
 *   planPlaneProject(raw)  pure conversion + validation (this is the dry run)
 *   applyPlan(plan)        one transaction per project; an existing identifier is never touched.
 * The snapshot is the raw JSON fetched from Plane (see plane-fetch.ts); Plane itself is only ever read. */
import { eq, and } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  activity, comment, cycle, issue, issueLabel, issueLink, issueModule, issueRelation, label, module, project, state,
  MODULE_STATUSES, PRIORITIES, STATE_GROUPS,
  type ModuleStatus, type Priority, type RelationType, type StateGroup,
} from "@/db/schema";
import { getDefaultWorkspace } from "@/server/services/workspace";
import { htmlToMarkdown } from "./html";

export const SNAPSHOT_FORMAT = "projectos-plane-snapshot";
export const SNAPSHOT_VERSION = 1;
export const IMPORT_ACTOR = "plane-import";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

export type PlaneProjectSnapshot = {
  project: Raw;
  states: Raw[];
  labels: Raw[];
  issues: Raw[];
  cycles: { cycle: Raw; issueIds: string[] }[];
  modules: { module: Raw; issueIds: string[] }[];
  /** keyed by Plane work item id */
  comments: Record<string, Raw[]>;
  links: Record<string, Raw[]>;
  relations: Record<string, Raw>;
  pages: Raw[];
  /** total reported by Plane's own list endpoint, to prove nothing was missed */
  expectedIssueCount?: number;
};
export type PlaneSnapshot = { format: typeof SNAPSHOT_FORMAT; version: number; fetchedAt: string; workspace: string; projects: PlaneProjectSnapshot[] };

export function parseSnapshot(raw: unknown): PlaneSnapshot {
  const s = raw as Partial<PlaneSnapshot> | null;
  if (!s || s.format !== SNAPSHOT_FORMAT) throw new Error("No es un snapshot de Plane de ProjectOS");
  if (s.version !== SNAPSHOT_VERSION) throw new Error(`Versión de snapshot no soportada: ${s.version}`);
  if (!Array.isArray(s.projects)) throw new Error("Snapshot sin proyectos");
  return s as PlaneSnapshot;
}

type Plan = {
  identifier: string;
  name: string;
  description: string;
  color: string;
  issueCounter: number;
  states: { key: string; name: string; group: StateGroup; color: string; position: number; isDefault: boolean }[];
  labels: { key: string; name: string; color: string }[];
  issues: {
    key: string; seq: number; title: string; description: string; stateKey: string; priority: Priority; parentKey: string | null;
    labelKeys: string[]; startDate: string | null; dueDate: string | null; sortOrder: number; createdAt: Date; updatedAt: Date;
    completedAt: Date | null; archivedAt: Date | null; type: "issue" | "epic";
  }[];
  cycles: { key: string; name: string; description: string; startDate: string | null; endDate: string | null; issueKeys: string[] }[];
  modules: { key: string; name: string; description: string; status: ModuleStatus; startDate: string | null; targetDate: string | null; issueKeys: string[] }[];
  comments: { issueKey: string; body: string; createdAt: Date }[];
  links: { issueKey: string; url: string; title: string; createdAt: Date }[];
  relations: { issueKey: string; relatedKey: string; type: RelationType }[];
  warnings: string[];
  errors: string[];
  skipped: { pages: number; assignees: number };
};
export type PlaneProjectPlan = Plan;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const ts = (v: unknown, fallback = new Date()) => {
  const d = typeof v === "string" ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : fallback;
};
const idOf = (v: unknown): string | null => (typeof v === "string" && v ? v : v && typeof v === "object" && typeof (v as Raw).id === "string" ? (v as Raw).id : null);
const hex = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback);

function moduleStatus(v: unknown): ModuleStatus {
  const s = str(v).toLowerCase().replace(/[- ]/g, "_");
  return (MODULE_STATUSES as readonly string[]).includes(s) ? (s as ModuleStatus) : "backlog";
}

export function planPlaneProject(snap: PlaneProjectSnapshot): PlaneProjectPlan {
  const p = snap.project;
  const warnings: string[] = [];
  const errors: string[] = [];
  const identifier = str(p.identifier).toUpperCase();
  if (!/^[A-Z][A-Z0-9]{1,9}$/.test(identifier)) errors.push(`Identificador de proyecto no válido: "${identifier}"`);

  const states: Plan["states"] = snap.states.map((s, i) => {
    const group = str(s.group) as StateGroup;
    if (!STATE_GROUPS.includes(group)) errors.push(`Estado "${s.name}" con grupo desconocido "${s.group}"`);
    return { key: s.id, name: str(s.name), group, color: hex(s.color, "#64748b"), position: typeof s.sequence === "number" ? s.sequence : i * 1000, isDefault: !!s.default };
  });
  if (!states.some((s) => s.isDefault)) {
    const first = states.find((s) => s.group === "unstarted") ?? states[0];
    if (first) first.isDefault = true;
  }
  const stateKeys = new Set(states.map((s) => s.key));
  const labels: Plan["labels"] = snap.labels.map((l) => ({ key: l.id, name: str(l.name), color: hex(l.color, "#94a3b8") }));
  const labelKeys = new Set(labels.map((l) => l.key));

  const seqs = new Set<number>();
  const issueKeys = new Set<string>();
  const parentOf = new Map<string, string>();
  let assignees = 0;
  const issues: Plan["issues"] = [];
  for (const i of snap.issues) {
    const seq = Number(i.sequence_id);
    if (!Number.isInteger(seq) || seq < 1) { errors.push(`Work item ${i.id} sin sequence_id válido`); continue; }
    if (seqs.has(seq)) { errors.push(`sequence_id duplicado: ${seq}`); continue; }
    seqs.add(seq);
    const stateKey = idOf(i.state_id ?? i.state);
    if (!stateKey || !stateKeys.has(stateKey)) { errors.push(`${identifier}-${seq}: estado desconocido (${stateKey})`); continue; }
    const priority = (str(i.priority) || "none") as Priority;
    if (!PRIORITIES.includes(priority)) warnings.push(`${identifier}-${seq}: prioridad "${i.priority}" → none`);
    const parent = idOf(i.parent_id ?? i.parent);
    if (parent) parentOf.set(i.id, parent);
    if (Array.isArray(i.assignees) && i.assignees.length) assignees++;
    const ls = (Array.isArray(i.label_ids) ? i.label_ids : Array.isArray(i.labels) ? i.labels : []).map(idOf).filter((x: string | null): x is string => !!x);
    for (const l of ls) if (!labelKeys.has(l)) warnings.push(`${identifier}-${seq}: etiqueta desconocida ${l}`);
    issueKeys.add(i.id);
    const state = states.find((s) => s.key === stateKey)!;
    issues.push({
      key: i.id,
      seq,
      title: str(i.name).trim() || `(sin título ${seq})`,
      description: htmlToMarkdown(i.description_html ?? i.description),
      stateKey,
      priority: PRIORITIES.includes(priority) ? priority : "none",
      parentKey: null,
      labelKeys: ls.filter((l: string) => labelKeys.has(l)),
      startDate: date(i.start_date),
      dueDate: date(i.target_date),
      sortOrder: typeof i.sort_order === "number" ? i.sort_order : seq * 1000,
      createdAt: ts(i.created_at),
      updatedAt: ts(i.updated_at),
      completedAt: state.group === "completed" || state.group === "cancelled" ? ts(i.completed_at ?? i.updated_at) : null,
      archivedAt: i.archived_at ? ts(i.archived_at) : null,
      type: i.type?.is_epic || i.is_epic ? "epic" : "issue",
    });
  }
  for (const i of issues) {
    const parent = parentOf.get(i.key);
    if (!parent) continue;
    if (issueKeys.has(parent)) i.parentKey = parent;
    else warnings.push(`${identifier}-${i.seq}: padre ${parent} fuera del proyecto, se ignora`);
  }
  if (snap.expectedIssueCount !== undefined && snap.expectedIssueCount !== snap.issues.length)
    errors.push(`Plane declara ${snap.expectedIssueCount} work items pero el snapshot tiene ${snap.issues.length}`);

  const keep = (ids: string[]) => ids.filter((id) => issueKeys.has(id));
  const cycles: Plan["cycles"] = snap.cycles.map(({ cycle: c, issueIds }) => ({
    key: c.id, name: str(c.name), description: str(c.description), startDate: date(c.start_date), endDate: date(c.end_date), issueKeys: keep(issueIds),
  }));
  // Work items also carry their own cycle_id; honour it when the cycle's issue list did not.
  for (const i of snap.issues) {
    const c = cycles.find((x) => x.key === i.cycle_id);
    if (c && issueKeys.has(i.id) && !c.issueKeys.includes(i.id)) c.issueKeys.push(i.id);
  }
  const seenCycle = new Map<string, string>();
  for (const c of cycles) for (const k of c.issueKeys) {
    if (seenCycle.has(k)) warnings.push(`Un work item está en dos ciclos (${seenCycle.get(k)} y ${c.name}); se conserva el último`);
    seenCycle.set(k, c.name);
  }
  const modules: Plan["modules"] = snap.modules.map(({ module: m, issueIds }) => ({
    key: m.id, name: str(m.name), description: str(m.description), status: moduleStatus(m.status),
    startDate: date(m.start_date), targetDate: date(m.target_date), issueKeys: keep(issueIds),
  }));
  for (const [kind, list] of [["ciclo", cycles], ["módulo", modules]] as const) {
    const names = new Set<string>();
    for (const x of list) {
      if (names.has(x.name)) errors.push(`Nombre de ${kind} duplicado: ${x.name}`);
      names.add(x.name);
    }
  }

  const comments: Plan["comments"] = [];
  for (const [issueKey, list] of Object.entries(snap.comments ?? {}))
    if (issueKeys.has(issueKey))
      for (const c of list) {
        const body = htmlToMarkdown(c.comment_html ?? c.comment_stripped ?? c.comment);
        if (body) comments.push({ issueKey, body, createdAt: ts(c.created_at) });
      }
  const links: Plan["links"] = [];
  for (const [issueKey, list] of Object.entries(snap.links ?? {}))
    if (issueKeys.has(issueKey))
      for (const l of list) if (str(l.url)) links.push({ issueKey, url: str(l.url), title: str(l.title) || str(l.metadata?.title), createdAt: ts(l.created_at) });

  const relations: Plan["relations"] = [];
  const seenRel = new Set<string>();
  const addRel = (a: string, b: string, type: RelationType) => {
    if (a === b || !issueKeys.has(a) || !issueKeys.has(b)) return;
    const [x, y] = type === "relates" && a > b ? [b, a] : [a, b];
    const k = `${x}|${y}|${type}`;
    if (seenRel.has(k)) return;
    seenRel.add(k);
    relations.push({ issueKey: x, relatedKey: y, type });
  };
  for (const [issueKey, r] of Object.entries(snap.relations ?? {})) {
    for (const o of (r?.blocking ?? []) as unknown[]) { const id = idOf(o); if (id) addRel(issueKey, id, "blocks"); }
    for (const o of (r?.blocked_by ?? []) as unknown[]) { const id = idOf(o); if (id) addRel(id, issueKey, "blocks"); }
    for (const o of (r?.duplicate ?? []) as unknown[]) { const id = idOf(o); if (id) addRel(issueKey, id, "duplicates"); }
    for (const o of (r?.relates_to ?? []) as unknown[]) { const id = idOf(o); if (id) addRel(issueKey, id, "relates"); }
    for (const k of ["start_after", "start_before", "finish_after", "finish_before"])
      if ((r?.[k] ?? []).length) warnings.push(`Relación "${k}" no soportada, se omite (${issueKey})`);
  }
  if (snap.pages.length) warnings.push(`${snap.pages.length} páginas no se importan todavía (el módulo de documentos llega en una fase posterior); quedan en el snapshot`);

  return {
    identifier, name: str(p.name) || identifier, description: str(p.description), color: hex(p.color, "#6366f1"),
    issueCounter: Math.max(0, ...issues.map((i) => i.seq)),
    states, labels, issues, cycles, modules, comments, links, relations, warnings, errors,
    skipped: { pages: snap.pages.length, assignees },
  };
}

export function summarize(plan: PlaneProjectPlan) {
  return {
    states: plan.states.length, labels: plan.labels.length, issues: plan.issues.length, cycles: plan.cycles.length,
    modules: plan.modules.length, comments: plan.comments.length, links: plan.links.length, relations: plan.relations.length,
  };
}

export type ImportReport = {
  identifier: string;
  status: "imported" | "planned" | "skipped" | "invalid";
  counts: ReturnType<typeof summarize>;
  warnings: string[];
  errors: string[];
  reason?: string;
};

export async function importPlaneSnapshot(
  snapshot: PlaneSnapshot,
  opts: { dryRun?: boolean; only?: string[]; expected?: Record<string, number> } = {},
): Promise<ImportReport[]> {
  const db = await getDb();
  const ws = await getDefaultWorkspace();
  const reports: ImportReport[] = [];
  const only = opts.only?.map((x) => x.toUpperCase());
  for (const snap of snapshot.projects) {
    const plan = planPlaneProject(snap);
    if (only && !only.includes(plan.identifier)) continue;
    const exp = opts.expected?.[plan.identifier];
    if (exp !== undefined && exp !== plan.issues.length) plan.errors.push(`Se esperaban ${exp} issues y el plan tiene ${plan.issues.length}`);
    const base = { identifier: plan.identifier, counts: summarize(plan), warnings: plan.warnings, errors: plan.errors };
    if (plan.errors.length) { reports.push({ ...base, status: "invalid" }); continue; }
    const existing = await db.query.project.findFirst({ where: and(eq(project.workspaceId, ws.id), eq(project.identifier, plan.identifier)) });
    if (existing) { reports.push({ ...base, status: "skipped", reason: `Ya existe un proyecto ${plan.identifier}; no se toca` }); continue; }
    if (opts.dryRun) { reports.push({ ...base, status: "planned" }); continue; }
    await applyPlan(plan, ws.id);
    reports.push({ ...base, status: "imported" });
  }
  return reports;
}

async function applyPlan(plan: PlaneProjectPlan, workspaceId: string) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [proj] = await tx
      .insert(project)
      .values({ workspaceId, identifier: plan.identifier, name: plan.name, description: plan.description, color: plan.color, issueCounter: plan.issueCounter })
      .returning();
    const stateId = new Map<string, string>();
    for (const s of plan.states) {
      const [row] = await tx
        .insert(state)
        .values({ projectId: proj.id, name: s.name, group: s.group, color: s.color, position: s.position, isDefault: s.isDefault ? 1 : 0 })
        .returning({ id: state.id });
      stateId.set(s.key, row.id);
    }
    const labelId = new Map<string, string>();
    for (const l of plan.labels) {
      const [row] = await tx.insert(label).values({ projectId: proj.id, name: l.name, color: l.color }).onConflictDoNothing().returning({ id: label.id });
      if (row) labelId.set(l.key, row.id);
      else {
        const [ex] = await tx.select({ id: label.id }).from(label).where(and(eq(label.projectId, proj.id), eq(label.name, l.name)));
        labelId.set(l.key, ex.id);
      }
    }
    const cycleOf = new Map<string, string>();
    for (const c of plan.cycles) {
      const [row] = await tx.insert(cycle).values({ projectId: proj.id, name: c.name, description: c.description, startDate: c.startDate, endDate: c.endDate }).returning({ id: cycle.id });
      for (const k of c.issueKeys) cycleOf.set(k, row.id);
    }
    const moduleIds = new Map<string, string>();
    for (const m of plan.modules) {
      const [row] = await tx
        .insert(module)
        .values({ projectId: proj.id, name: m.name, description: m.description, status: m.status, startDate: m.startDate, targetDate: m.targetDate })
        .returning({ id: module.id });
      moduleIds.set(m.key, row.id);
    }
    const issueId = new Map<string, string>();
    for (const i of plan.issues) {
      const [row] = await tx
        .insert(issue)
        .values({
          projectId: proj.id, seq: i.seq, type: i.type, title: i.title, description: i.description, stateId: stateId.get(i.stateKey)!, priority: i.priority,
          cycleId: cycleOf.get(i.key) ?? null, startDate: i.startDate, dueDate: i.dueDate, sortOrder: i.sortOrder, completedAt: i.completedAt, archivedAt: i.archivedAt,
          createdBy: IMPORT_ACTOR, createdAt: i.createdAt, updatedAt: i.updatedAt,
        })
        .returning({ id: issue.id });
      issueId.set(i.key, row.id);
    }
    for (const i of plan.issues) {
      if (i.parentKey) await tx.update(issue).set({ parentId: issueId.get(i.parentKey)! }).where(eq(issue.id, issueId.get(i.key)!));
      for (const l of i.labelKeys) await tx.insert(issueLabel).values({ issueId: issueId.get(i.key)!, labelId: labelId.get(l)! }).onConflictDoNothing();
    }
    for (const m of plan.modules)
      for (const k of m.issueKeys) await tx.insert(issueModule).values({ issueId: issueId.get(k)!, moduleId: moduleIds.get(m.key)! }).onConflictDoNothing();
    for (const c of plan.comments) await tx.insert(comment).values({ issueId: issueId.get(c.issueKey)!, actor: IMPORT_ACTOR, body: c.body, createdAt: c.createdAt, updatedAt: c.createdAt });
    for (const l of plan.links) await tx.insert(issueLink).values({ issueId: issueId.get(l.issueKey)!, kind: "url", url: l.url, title: l.title, actor: IMPORT_ACTOR, createdAt: l.createdAt });
    for (const r of plan.relations)
      await tx.insert(issueRelation).values({ issueId: issueId.get(r.issueKey)!, relatedIssueId: issueId.get(r.relatedKey)!, type: r.type }).onConflictDoNothing();
    await tx.insert(activity).values({ projectId: proj.id, actor: IMPORT_ACTOR, action: "project.imported", data: { source: "plane", ...summarize(plan) } });
  });
}
