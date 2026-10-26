import type { Priority, StateGroup, IssueType } from "@/db/schema";
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
  sortOrder: number;
  labels: LabelDTO[];
  pending?: boolean;
};

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
  sortOrder: number;
  labels: { label: LabelDTO }[];
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
    sortOrder: row.sortOrder,
    labels: row.labels.map((l) => ({ id: l.label.id, name: l.label.name, color: l.label.color })),
  };
}

export const toStateDTO = (s: StateDTO): StateDTO => ({
  id: s.id,
  name: s.name,
  group: s.group,
  color: s.color,
  position: s.position,
});
