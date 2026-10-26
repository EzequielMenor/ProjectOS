import { relations, sql } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  date,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const STATE_GROUPS = ["backlog", "unstarted", "started", "completed", "cancelled"] as const;
export type StateGroup = (typeof STATE_GROUPS)[number];

export const PRIORITIES = ["none", "urgent", "high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const ISSUE_TYPES = ["issue", "epic"] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const RELATION_TYPES = ["blocks", "relates", "duplicates"] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export const LINK_KINDS = ["url", "commit", "pr", "evidence"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const workspace = pgTable("workspace", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

/** Humans and agents that can be assigned work or author changes. */
export const member = pgTable("member", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  kind: text("kind", { enum: ["human", "agent"] }).notNull().default("human"),
  createdAt: createdAt(),
});

export const TOKEN_SCOPES = ["read", "write"] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];

/** Bearer tokens for agents/API clients. Only the SHA-256 hash is stored. */
export const apiToken = pgTable("api_token", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  scope: text("scope", { enum: TOKEN_SCOPES }).notNull().default("read"),
  createdAt: createdAt(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const project = pgTable(
  "project",
  {
    id: id(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
    identifier: text("identifier").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    color: text("color").notNull().default("#6366f1"),
    issueCounter: integer("issue_counter").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("project_workspace_identifier").on(t.workspaceId, t.identifier)],
);

export const state = pgTable(
  "state",
  {
    id: id(),
    projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    group: text("group", { enum: STATE_GROUPS }).notNull(),
    color: text("color").notNull(),
    position: doublePrecision("position").notNull().default(0),
    isDefault: integer("is_default").notNull().default(0),
  },
  (t) => [index("state_project_idx").on(t.projectId)],
);

export const MODULE_STATUSES = ["backlog", "planned", "in_progress", "paused", "completed", "cancelled"] as const;
export type ModuleStatus = (typeof MODULE_STATUSES)[number];

/** A time-boxed sprint. An issue belongs to at most one cycle. */
export const cycle = pgTable(
  "cycle",
  {
    id: id(),
    projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    startDate: date("start_date"),
    endDate: date("end_date"),
    createdAt: createdAt(),
  },
  (t) => [unique("cycle_project_name").on(t.projectId, t.name)],
);

/** A thematic group of work (a feature or phase). An issue can be in several modules. */
// A table named `module` is the clearest domain name; the lint rule targets assigning to Node's `module`.
// eslint-disable-next-line @next/next/no-assign-module-variable
export const module = pgTable(
  "module",
  {
    id: id(),
    projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: text("status", { enum: MODULE_STATUSES }).notNull().default("backlog"),
    startDate: date("start_date"),
    targetDate: date("target_date"),
    createdAt: createdAt(),
  },
  (t) => [unique("module_project_name").on(t.projectId, t.name)],
);

export const issueModule = pgTable(
  "issue_module",
  {
    issueId: uuid("issue_id").notNull().references(() => issue.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id").notNull().references(() => module.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.issueId, t.moduleId] }), index("issue_module_module_idx").on(t.moduleId)],
);

/** A dated goal on the roadmap; progress comes from the issues assigned to it. */
export const milestone = pgTable(
  "milestone",
  {
    id: id(),
    projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    targetDate: date("target_date"),
    createdAt: createdAt(),
  },
  (t) => [unique("milestone_project_name").on(t.projectId, t.name)],
);

export const issue = pgTable(
  "issue",
  {
    id: id(),
    projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    type: text("type", { enum: ISSUE_TYPES }).notNull().default("issue"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    stateId: uuid("state_id").notNull().references(() => state.id),
    priority: text("priority", { enum: PRIORITIES }).notNull().default("none"),
    parentId: uuid("parent_id"),
    cycleId: uuid("cycle_id").references(() => cycle.id, { onDelete: "set null" }),
    milestoneId: uuid("milestone_id").references(() => milestone.id, { onDelete: "set null" }),
    assigneeId: uuid("assignee_id").references(() => member.id, { onDelete: "set null" }),
    estimate: integer("estimate"),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    sortOrder: doublePrecision("sort_order").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: text("created_by").notNull().default("user"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("issue_project_seq").on(t.projectId, t.seq),
    index("issue_project_state_idx").on(t.projectId, t.stateId),
    index("issue_parent_idx").on(t.parentId),
  ],
);

export const label = pgTable(
  "label",
  {
    id: id(),
    projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#94a3b8"),
  },
  (t) => [unique("label_project_name").on(t.projectId, t.name)],
);

export const issueLabel = pgTable(
  "issue_label",
  {
    issueId: uuid("issue_id").notNull().references(() => issue.id, { onDelete: "cascade" }),
    labelId: uuid("label_id").notNull().references(() => label.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.issueId, t.labelId] })],
);

export const issueRelation = pgTable(
  "issue_relation",
  {
    id: id(),
    issueId: uuid("issue_id").notNull().references(() => issue.id, { onDelete: "cascade" }),
    relatedIssueId: uuid("related_issue_id").notNull().references(() => issue.id, { onDelete: "cascade" }),
    type: text("type", { enum: RELATION_TYPES }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique("issue_relation_unique").on(t.issueId, t.relatedIssueId, t.type)],
);

export const comment = pgTable(
  "comment",
  {
    id: id(),
    issueId: uuid("issue_id").notNull().references(() => issue.id, { onDelete: "cascade" }),
    actor: text("actor").notNull().default("user"),
    body: text("body").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("comment_issue_idx").on(t.issueId)],
);

export const issueLink = pgTable(
  "issue_link",
  {
    id: id(),
    issueId: uuid("issue_id").notNull().references(() => issue.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: LINK_KINDS }).notNull().default("url"),
    url: text("url").notNull(),
    title: text("title").notNull().default(""),
    actor: text("actor").notNull().default("user"),
    createdAt: createdAt(),
  },
  (t) => [index("issue_link_issue_idx").on(t.issueId)],
);

/** Append-only audit log. Never updated or deleted by the application. */
export const activity = pgTable(
  "activity",
  {
    id: id(),
    projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
    issueId: uuid("issue_id").references(() => issue.id, { onDelete: "cascade" }),
    actor: text("actor").notNull().default("user"),
    action: text("action").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("activity_issue_idx").on(t.issueId), index("activity_project_idx").on(t.projectId)],
);

export const projectRelations = relations(project, ({ many }) => ({
  states: many(state),
  issues: many(issue),
  labels: many(label),
}));

export const issueRelations = relations(issue, ({ one, many }) => ({
  project: one(project, { fields: [issue.projectId], references: [project.id] }),
  state: one(state, { fields: [issue.stateId], references: [state.id] }),
  assignee: one(member, { fields: [issue.assigneeId], references: [member.id] }),
  parent: one(issue, { fields: [issue.parentId], references: [issue.id], relationName: "children" }),
  children: many(issue, { relationName: "children" }),
  comments: many(comment),
  links: many(issueLink),
  labels: many(issueLabel),
  cycle: one(cycle, { fields: [issue.cycleId], references: [cycle.id] }),
  milestone: one(milestone, { fields: [issue.milestoneId], references: [milestone.id] }),
  modules: many(issueModule),
}));

export const issueModuleRelations = relations(issueModule, ({ one }) => ({
  issue: one(issue, { fields: [issueModule.issueId], references: [issue.id] }),
  module: one(module, { fields: [issueModule.moduleId], references: [module.id] }),
}));

export const issueLabelRelations = relations(issueLabel, ({ one }) => ({
  issue: one(issue, { fields: [issueLabel.issueId], references: [issue.id] }),
  label: one(label, { fields: [issueLabel.labelId], references: [label.id] }),
}));

export const stateRelations = relations(state, ({ one }) => ({
  project: one(project, { fields: [state.projectId], references: [project.id] }),
}));

export const commentRelations = relations(comment, ({ one }) => ({
  issue: one(issue, { fields: [comment.issueId], references: [issue.id] }),
}));

export const issueLinkRelations = relations(issueLink, ({ one }) => ({
  issue: one(issue, { fields: [issueLink.issueId], references: [issue.id] }),
}));
