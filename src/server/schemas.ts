import { z } from "zod";
import { ISSUE_TYPES, LINK_KINDS, PRIORITIES, RELATION_TYPES } from "@/db/schema";

export const identifierSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9]{1,9}$/, "2-10 caracteres: letras mayúsculas o dígitos, empezando por letra")
  .refine((v) => !["PROJECTS", "SETTINGS", "API"].includes(v), "Identificador reservado");

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const createProjectInput = z.object({
  identifier: identifierSchema,
  name: z.string().trim().min(1).max(100),
  description: z.string().max(20_000).optional(),
  color: colorSchema.optional(),
});

export const updateProjectInput = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(20_000).optional(),
  color: colorSchema.optional(),
});

export const createIssueInput = z.object({
  projectId: z.uuid(),
  title: z.string().trim().min(1).max(500),
  description: z.string().max(200_000).optional(),
  stateId: z.uuid().optional(),
  priority: z.enum(PRIORITIES).optional(),
  type: z.enum(ISSUE_TYPES).optional(),
  parentId: z.uuid().nullish(),
  assigneeId: z.uuid().nullish(),
  estimate: z.number().int().min(0).max(1000).nullish(),
  startDate: dateSchema.nullish(),
  dueDate: dateSchema.nullish(),
  labelIds: z.array(z.uuid()).max(50).optional(),
});

export const updateIssueInput = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(200_000).optional(),
  stateId: z.uuid().optional(),
  priority: z.enum(PRIORITIES).optional(),
  type: z.enum(ISSUE_TYPES).optional(),
  parentId: z.uuid().nullable().optional(),
  assigneeId: z.uuid().nullable().optional(),
  estimate: z.number().int().min(0).max(1000).nullable().optional(),
  startDate: dateSchema.nullable().optional(),
  dueDate: dateSchema.nullable().optional(),
  labelIds: z.array(z.uuid()).max(50).optional(),
});

export const moveIssueInput = z.object({
  stateId: z.uuid(),
  prevId: z.uuid().nullish(),
  nextId: z.uuid().nullish(),
});

export const listIssuesInput = z.object({
  projectId: z.uuid().optional(),
  stateId: z.uuid().optional(),
  stateGroup: z.enum(["backlog", "unstarted", "started", "completed", "cancelled"]).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assigneeId: z.uuid().optional(),
  parentId: z.uuid().optional(),
  type: z.enum(ISSUE_TYPES).optional(),
  labelId: z.uuid().optional(),
  query: z.string().trim().max(200).optional(),
  includeArchived: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const addCommentInput = z.object({ body: z.string().trim().min(1).max(50_000) });

export const addLinkInput = z.object({
  kind: z.enum(LINK_KINDS).default("url"),
  url: z.string().trim().min(1).max(2000),
  title: z.string().max(300).optional(),
});

export const addRelationInput = z.object({
  relatedIssueId: z.uuid(),
  type: z.enum(RELATION_TYPES),
});

export type CreateProjectInput = z.infer<typeof createProjectInput>;
export type CreateIssueInput = z.infer<typeof createIssueInput>;
export type UpdateIssueInput = z.infer<typeof updateIssueInput>;
export type MoveIssueInput = z.infer<typeof moveIssueInput>;
export type ListIssuesInput = z.infer<typeof listIssuesInput>;
