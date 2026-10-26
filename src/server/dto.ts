import type { Priority, PropertyType, StateGroup, IssueType } from "@/db/schema";
import { issueKey } from "./services/issues";

export type StateDTO = { id: string; name: string; group: StateGroup; color: string; position: number };
export type LabelDTO = { id: string; name: string; color: string };
export type IssueDTO = {
  id: string;
  key: string;
  seq: number;
  title: string;
  type: IssueType;
  stateId: string;
  priority: Priority;
  parentId: string | null;
  assigneeId: string | null;
  estimate: number | null;
  dueDate: string | null;
  cycleId: string | null;
  milestoneId: string | null;
  moduleIds: string[];
  sortOrder: number;
  labels: LabelDTO[];
  /** Custom property values by property id (absent = unset). */
  properties: Record<string, string | number>;
  pending?: boolean;
};
export type MemberDTO = { id: string; name: string; kind: "human" | "agent" };
export const toMemberDTO = (m: MemberDTO): MemberDTO => ({ id: m.id, name: m.name, kind: m.kind });
export type PropertyDTO = { id: string; name: string; type: PropertyType; options: string[] };

type IssueRowLike = {
  id: string;
  seq: number;
  title: string;
  type: IssueType;
  stateId: string;
  priority: Priority;
  parentId: string | null;
  assigneeId: string | null;
  estimate: number | null;
  dueDate: string | null;
  cycleId: string | null;
  milestoneId: string | null;
  modules: { moduleId: string }[];
  sortOrder: number;
  labels: { label: LabelDTO }[];
  propertyValues: { propertyId: string; value: string | number }[];
};

export function toIssueDTO(row: IssueRowLike, identifier: string): IssueDTO {
  return {
    id: row.id,
    key: issueKey(identifier, row.seq),
    seq: row.seq,
    title: row.title,
    type: row.type,
    stateId: row.stateId,
    priority: row.priority,
    parentId: row.parentId,
    assigneeId: row.assigneeId,
    estimate: row.estimate,
    dueDate: row.dueDate,
    cycleId: row.cycleId,
    milestoneId: row.milestoneId,
    moduleIds: row.modules.map((m) => m.moduleId),
    sortOrder: row.sortOrder,
    labels: row.labels.map((l) => ({ id: l.label.id, name: l.label.name, color: l.label.color })),
    properties: Object.fromEntries(row.propertyValues.map((v) => [v.propertyId, v.value])),
  };
}

export const toPropertyDTO = (p: PropertyDTO): PropertyDTO => ({ id: p.id, name: p.name, type: p.type, options: p.options });

export const toStateDTO = (s: StateDTO): StateDTO => ({
  id: s.id,
  name: s.name,
  group: s.group,
  color: s.color,
  position: s.position,
});
