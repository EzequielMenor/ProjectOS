import { z, type ZodRawShape } from "zod";
import { ISSUE_TYPES, LINK_KINDS, PRIORITIES, RELATION_TYPES, STATE_GROUPS, type TokenScope } from "@/db/schema";
import { ServiceError, invalid } from "../errors";
import {
  addComment,
  addLink,
  addRelation,
  createIssue,
  getIssueByKey,
  issueKey,
  listActivity,
  listIssues,
  setIssueArchived,
  updateIssue,
} from "../services/issues";
import { listLabels, resolveLabelIds } from "../services/labels";
import { assignIssue, createCycle, createMilestone, createModule, listCycles, listMilestones, listModules } from "../services/planning";
import { getProjectByIdentifier, listProjects, listStates } from "../services/projects";
import type { AuthContext } from "../services/tokens";
import { listRelations, nextWork } from "../services/work";

/**
 * The single catalogue of agent-facing operations. MCP and REST are both generated from it, so
 * permissions and validation cannot drift. There is deliberately NO delete tool: the destructive
 * operations (delete project/issue/comment, restore) are human-only. Archiving is reversible.
 */
export type ToolDef<S extends ZodRawShape = ZodRawShape> = {
  name: string;
  description: string;
  scope: TokenScope;
  shape: S;
  run: (args: z.infer<z.ZodObject<S>>, ctx: AuthContext) => Promise<unknown>;
};

const tool = <S extends ZodRawShape>(def: ToolDef<S>) => def as unknown as ToolDef;

const key = z.string().describe("Issue key such as FICH-12");
const projectArg = z.string().describe("Project identifier such as FICH");

async function project(identifier: string) {
  const p = await getProjectByIdentifier(identifier);
  if (!p) throw new ServiceError("not_found", `Proyecto ${identifier} no encontrado`);
  return p;
}

async function resolveState(projectId: string, name: string) {
  const states = await listStates(projectId);
  const s = states.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
  if (!s) throw invalid(`Estado desconocido "${name}". Válidos: ${states.map((x) => x.name).join(", ")}`);
  return s;
}

type IssueLike = {
  id: string;
  seq: number;
  title: string;
  type: string;
  priority: string;
  estimate: number | null;
  startDate: string | null;
  dueDate: string | null;
  archivedAt: Date | null;
  state: { name: string; group: string };
  labels: { label: { name: string } }[];
  assignee?: { name: string } | null;
  cycle?: { name: string } | null;
  milestone?: { name: string } | null;
  modules?: { module: { name: string } }[];
};

const summary = (i: IssueLike, identifier: string) => ({
  key: issueKey(identifier, i.seq),
  title: i.title,
  type: i.type,
  state: i.state.name,
  stateGroup: i.state.group,
  priority: i.priority,
  assignee: i.assignee?.name ?? null,
  estimate: i.estimate,
  startDate: i.startDate,
  dueDate: i.dueDate,
  labels: i.labels.map((l) => l.label.name),
  cycle: i.cycle?.name ?? null,
  modules: (i.modules ?? []).map((m) => m.module.name),
  milestone: i.milestone?.name ?? null,
  archived: Boolean(i.archivedAt),
});

const pct = (p: { total: number; completed: number; cancelled: number }) => {
  const live = p.total - p.cancelled;
  return live > 0 ? Math.round((p.completed / live) * 100) : 0;
};

const evidence = z.object({
  kind: z.enum(LINK_KINDS).default("evidence"),
  url: z.string().describe("URL, commit SHA/URL, PR URL or file path"),
  title: z.string().optional(),
});

export const TOOLS: ToolDef[] = [
  // ---- read ----
  tool({
    name: "list_projects",
    description: "List active projects with their identifiers.",
    scope: "read",
    shape: {},
    run: async () => (await listProjects()).map((p) => ({ identifier: p.identifier, name: p.name, description: p.description })),
  }),
  tool({
    name: "get_project",
    description: "Get a project's workflow states and labels. Use the state names with set_state / create_issue.",
    scope: "read",
    shape: { project: projectArg },
    run: async ({ project: id }) => {
      const p = await project(id);
      const [states, labels] = await Promise.all([listStates(p.id), listLabels(p.id)]);
      return {
        identifier: p.identifier,
        name: p.name,
        description: p.description,
        states: states.map((s) => ({ name: s.name, group: s.group })),
        labels: labels.map((l) => l.name),
      };
    },
  }),
  tool({
    name: "list_issues",
    description: "List issues with optional filters. Returns compact summaries ordered by board position.",
    scope: "read",
    shape: {
      project: projectArg.optional(),
      state: z.string().optional().describe("State name, e.g. 'In Progress'"),
      stateGroup: z.enum(STATE_GROUPS).optional(),
      priority: z.enum(PRIORITIES).optional(),
      type: z.enum(ISSUE_TYPES).optional(),
      query: z.string().optional().describe("Text in title or description"),
      parent: key.optional().describe("Only children of this issue"),
      includeArchived: z.boolean().optional(),
      limit: z.number().int().min(1).max(200).default(50),
    },
    run: async (a) => {
      const p = a.project ? await project(a.project) : null;
      const stateId = p && a.state ? (await resolveState(p.id, a.state)).id : undefined;
      if (a.state && !p) throw invalid("'state' requiere 'project'; usa stateGroup para filtrar entre proyectos");
      const parentId = a.parent ? (await getIssueByKey(a.parent)).id : undefined;
      const rows = await listIssues({
        projectId: p?.id,
        stateId,
        stateGroup: a.stateGroup,
        priority: a.priority,
        type: a.type,
        query: a.query,
        parentId,
        includeArchived: a.includeArchived,
        limit: a.limit,
      });
      return rows.map((r) => summary(r, r.project.identifier));
    },
  }),
  tool({
    name: "get_issue",
    description: "Get one issue in full: description, comments, links (commits/PRs/evidence), relations, children and activity.",
    scope: "read",
    shape: { key },
    run: async ({ key: k }) => {
      const i = await getIssueByKey(k);
      const [relations, activity] = await Promise.all([listRelations(i.id), listActivity(i.id)]);
      return {
        ...summary(i, i.project.identifier),
        description: i.description,
        parent: i.parent ? issueKey(i.project.identifier, i.parent.seq) : null,
        children: i.children.map((c) => ({ key: issueKey(i.project.identifier, c.seq), title: c.title, state: c.state.name })),
        relations,
        links: i.links.map((l) => ({ kind: l.kind, url: l.url, title: l.title, by: l.actor })),
        comments: i.comments.map((c) => ({ by: c.actor, at: c.createdAt, body: c.body })),
        activity: activity.slice(-30).map((a) => ({ by: a.actor, at: a.createdAt, action: a.action })),
      };
    },
  }),
  tool({
    name: "search",
    description: "Search issues by text or by exact key (e.g. 'FICH-3'), across all projects.",
    scope: "read",
    shape: { query: z.string().min(1), limit: z.number().int().min(1).max(50).default(20) },
    run: async ({ query, limit }) => {
      const exact = await getIssueByKey(query).then((i) => [summary(i, i.project.identifier)]).catch(() => []);
      const rows = await listIssues({ query, limit });
      const found = rows.map((r) => summary(r, r.project.identifier));
      const seen = new Set(exact.map((e) => e.key));
      return [...exact, ...found.filter((f) => !seen.has(f.key))];
    },
  }),
  tool({
    name: "next_work",
    description:
      "What to work on next: open, unblocked issues (epics excluded), started ones first, then by priority and board order.",
    scope: "read",
    shape: { project: projectArg.optional(), limit: z.number().int().min(1).max(20).default(5) },
    run: async ({ project: id, limit }) => {
      const p = id ? await project(id) : null;
      const rows = await nextWork({ projectId: p?.id, limit });
      return rows.map((r) => summary(r, r.project.identifier));
    },
  }),
  tool({
    name: "list_cycles",
    description: "List a project's cycles (sprints) with dates and progress.",
    scope: "read",
    shape: { project: projectArg },
    run: async ({ project: id }) => {
      const p = await project(id);
      return (await listCycles(p.id)).map((c) => ({ name: c.name, startDate: c.startDate, endDate: c.endDate, progress: c.progress, percentDone: pct(c.progress) }));
    },
  }),
  tool({
    name: "list_modules",
    description: "List a project's modules (feature/phase groupings) with status and progress.",
    scope: "read",
    shape: { project: projectArg },
    run: async ({ project: id }) => {
      const p = await project(id);
      return (await listModules(p.id)).map((m) => ({ name: m.name, status: m.status, startDate: m.startDate, targetDate: m.targetDate, progress: m.progress, percentDone: pct(m.progress) }));
    },
  }),
  tool({
    name: "list_milestones",
    description: "List a project's roadmap milestones with target dates and progress.",
    scope: "read",
    shape: { project: projectArg },
    run: async ({ project: id }) => {
      const p = await project(id);
      return (await listMilestones(p.id)).map((m) => ({ name: m.name, targetDate: m.targetDate, progress: m.progress, percentDone: pct(m.progress) }));
    },
  }),

  // ---- write ----
  tool({
    name: "create_issue",
    description: "Create an issue. Missing state defaults to the project's default state. Labels are created if new.",
    scope: "write",
    shape: {
      project: projectArg,
      title: z.string().min(1).max(500),
      description: z.string().optional().describe("Markdown"),
      state: z.string().optional(),
      priority: z.enum(PRIORITIES).optional(),
      type: z.enum(ISSUE_TYPES).optional(),
      parent: key.optional(),
      estimate: z.number().int().min(0).optional(),
      startDate: z.string().optional().describe("YYYY-MM-DD"),
      dueDate: z.string().optional().describe("YYYY-MM-DD"),
      labels: z.array(z.string()).optional().describe("Label names"),
    },
    run: async (a, ctx) => {
      const p = await project(a.project);
      const created = await createIssue(
        {
          projectId: p.id,
          title: a.title,
          description: a.description,
          stateId: a.state ? (await resolveState(p.id, a.state)).id : undefined,
          priority: a.priority,
          type: a.type,
          parentId: a.parent ? (await getIssueByKey(a.parent)).id : undefined,
          estimate: a.estimate,
          startDate: a.startDate,
          dueDate: a.dueDate,
          labelIds: a.labels ? await resolveLabelIds(p.id, a.labels) : undefined,
        },
        ctx.actor,
      );
      return { key: issueKey(p.identifier, created.seq), id: created.id };
    },
  }),
  tool({
    name: "update_issue",
    description:
      "Update fields of an issue (title, description, priority, estimate, dates, labels, parent). Previous values are kept in the activity log. To change state use set_state or complete_issue.",
    scope: "write",
    shape: {
      key,
      title: z.string().min(1).max(500).optional(),
      description: z.string().optional(),
      priority: z.enum(PRIORITIES).optional(),
      type: z.enum(ISSUE_TYPES).optional(),
      parent: key.nullable().optional().describe("Parent key, or null to detach"),
      estimate: z.number().int().min(0).nullable().optional(),
      startDate: z.string().nullable().optional(),
      dueDate: z.string().nullable().optional(),
      labels: z.array(z.string()).optional().describe("Replaces the full label set"),
    },
    run: async ({ key: k, parent, labels, ...rest }, ctx) => {
      const i = await getIssueByKey(k);
      await updateIssue(
        i.id,
        {
          ...rest,
          ...(parent !== undefined ? { parentId: parent ? (await getIssueByKey(parent)).id : null } : {}),
          ...(labels ? { labelIds: await resolveLabelIds(i.projectId, labels) } : {}),
        },
        ctx.actor,
      );
      return { key: k, updated: true };
    },
  }),
  tool({
    name: "set_state",
    description: "Move an issue to a workflow state by name (see get_project for valid names).",
    scope: "write",
    shape: { key, state: z.string() },
    run: async ({ key: k, state }, ctx) => {
      const i = await getIssueByKey(k);
      const s = await resolveState(i.projectId, state);
      await updateIssue(i.id, { stateId: s.id }, ctx.actor);
      return { key: k, state: s.name };
    },
  }),
  tool({
    name: "complete_issue",
    description:
      "Mark an issue done (moves it to the project's first 'completed' state). Optionally attach a closing note and evidence such as commits, PRs or test output.",
    scope: "write",
    shape: { key, note: z.string().optional(), evidence: z.array(evidence).optional() },
    run: async ({ key: k, note, evidence: ev }, ctx) => {
      const i = await getIssueByKey(k);
      const done = (await listStates(i.projectId)).find((s) => s.group === "completed");
      if (!done) throw invalid("El proyecto no tiene un estado de tipo 'completed'");
      await updateIssue(i.id, { stateId: done.id }, ctx.actor);
      for (const e of ev ?? []) await addLink(i.id, e, ctx.actor);
      if (note) await addComment(i.id, { body: note }, ctx.actor);
      return { key: k, state: done.name };
    },
  }),
  tool({
    name: "add_comment",
    description: "Add a Markdown comment to an issue.",
    scope: "write",
    shape: { key, body: z.string().min(1) },
    run: async ({ key: k, body }, ctx) => {
      const i = await getIssueByKey(k);
      await addComment(i.id, { body }, ctx.actor);
      return { key: k, commented: true };
    },
  }),
  tool({
    name: "log_progress",
    description:
      "Record implementation progress on an issue: a short summary comment plus optional evidence (commit, PR, test run, file). Does not change state.",
    scope: "write",
    shape: { key, summary: z.string().min(1), evidence: z.array(evidence).optional() },
    run: async ({ key: k, summary: text, evidence: ev }, ctx) => {
      const i = await getIssueByKey(k);
      for (const e of ev ?? []) await addLink(i.id, e, ctx.actor);
      await addComment(i.id, { body: `**Progreso:** ${text}` }, ctx.actor);
      return { key: k, logged: true, evidence: ev?.length ?? 0 };
    },
  }),
  tool({
    name: "add_link",
    description: "Attach a link to an issue; use kind 'commit' or 'pr' to associate commits and pull requests.",
    scope: "write",
    shape: { key, ...evidence.shape },
    run: async ({ key: k, ...link }, ctx) => {
      const i = await getIssueByKey(k);
      await addLink(i.id, link, ctx.actor);
      return { key: k, linked: link.url };
    },
  }),
  tool({
    name: "add_relation",
    description: "Relate two issues of the same project. 'blocks' means `key` blocks `related` (related stays blocked until key is done).",
    scope: "write",
    shape: { key, related: key, type: z.enum(RELATION_TYPES) },
    run: async ({ key: k, related, type }, ctx) => {
      const [a, b] = await Promise.all([getIssueByKey(k), getIssueByKey(related)]);
      await addRelation(a.id, { relatedIssueId: b.id, type }, ctx.actor);
      return { key: k, type, related };
    },
  }),
  tool({
    name: "create_cycle",
    description: "Create a cycle (sprint) in a project.",
    scope: "write",
    shape: { project: projectArg, name: z.string(), startDate: z.string().optional().describe("YYYY-MM-DD"), endDate: z.string().optional(), description: z.string().optional() },
    run: async ({ project: id, ...rest }) => {
      const p = await project(id);
      return { name: (await createCycle({ projectId: p.id, ...rest })).name };
    },
  }),
  tool({
    name: "create_module",
    description: "Create a module (a feature or phase that groups issues).",
    scope: "write",
    shape: { project: projectArg, name: z.string(), description: z.string().optional(), status: z.enum(["backlog", "planned", "in_progress", "paused", "completed", "cancelled"]).optional(), startDate: z.string().optional(), targetDate: z.string().optional() },
    run: async ({ project: id, ...rest }) => {
      const p = await project(id);
      return { name: (await createModule({ projectId: p.id, ...rest })).name };
    },
  }),
  tool({
    name: "create_milestone",
    description: "Create a roadmap milestone with an optional target date.",
    scope: "write",
    shape: { project: projectArg, name: z.string(), description: z.string().optional(), targetDate: z.string().optional() },
    run: async ({ project: id, ...rest }) => {
      const p = await project(id);
      return { name: (await createMilestone({ projectId: p.id, ...rest })).name };
    },
  }),
  tool({
    name: "assign_issue",
    description:
      "Place an issue in a cycle, milestone and/or modules by name (create them first with create_cycle / create_module / create_milestone). Pass null to clear cycle or milestone; 'modules' replaces the full module set. Omitted fields are unchanged.",
    scope: "write",
    shape: { key, cycle: z.string().nullable().optional(), milestone: z.string().nullable().optional(), modules: z.array(z.string()).optional() },
    run: async ({ key: k, cycle, milestone, modules }, ctx) => {
      const i = await getIssueByKey(k);
      const byName = async <T extends { id: string; name: string }>(list: Promise<T[]>, wanted: string, what: string) => {
        const found = (await list).find((x) => x.name.toLowerCase() === wanted.trim().toLowerCase());
        if (!found) throw invalid(`${what} "${wanted}" no existe en el proyecto`);
        return found.id;
      };
      await assignIssue(
        i.id,
        {
          ...(cycle !== undefined ? { cycleId: cycle === null ? null : await byName(listCycles(i.projectId), cycle, "Ciclo") } : {}),
          ...(milestone !== undefined ? { milestoneId: milestone === null ? null : await byName(listMilestones(i.projectId), milestone, "Hito") } : {}),
          ...(modules ? { moduleIds: await Promise.all(modules.map((m) => byName(listModules(i.projectId), m, "Módulo"))) } : {}),
        },
        ctx.actor,
      );
      return { key: k, assigned: true };
    },
  }),
  tool({
    name: "archive_issue",
    description: "Archive (hide) an issue, or unarchive with archived=false. Reversible; nothing is deleted.",
    scope: "write",
    shape: { key, archived: z.boolean().default(true) },
    run: async ({ key: k, archived }, ctx) => {
      const i = await getIssueByKey(k);
      await setIssueArchived(i.id, archived, ctx.actor);
      return { key: k, archived };
    },
  }),
];

export function toolByName(name: string) {
  return TOOLS.find((t) => t.name === name);
}

const canUse = (scope: TokenScope, needed: TokenScope) => needed === "read" || scope === "write";

/** Validates args and enforces the token scope; every transport must call tools through here. */
export async function callTool(name: string, rawArgs: unknown, ctx: AuthContext) {
  const t = toolByName(name);
  if (!t) throw new ServiceError("not_found", `Herramienta desconocida: ${name}`);
  if (!canUse(ctx.scope, t.scope)) throw new ServiceError("forbidden", `El token "${ctx.name}" es de solo lectura`);
  const args = z.object(t.shape).parse(rawArgs ?? {});
  return t.run(args, ctx);
}

export function describeTools() {
  return TOOLS.map((t) => ({ name: t.name, description: t.description, scope: t.scope, inputSchema: z.toJSONSchema(z.object(t.shape)) }));
}
