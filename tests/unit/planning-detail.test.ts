import { beforeAll, describe, expect, it } from "vitest";
import { createProject, listStates } from "@/server/services/projects";
import { createIssue, addRelation, setIssueArchived, updateIssue } from "@/server/services/issues";
import { assignIssue, createCycle, createMilestone, createModule } from "@/server/services/planning";
import { getPlanningDetail } from "@/server/services/planning-detail";

let projectId: string;
let otherId: string;
beforeAll(async () => {
  projectId = (await createProject({ identifier: "DETAIL", name: "Planning detail" })).id;
  otherId = (await createProject({ identifier: "OTHER", name: "Other" })).id;
});

describe("planning detail", () => {
  for (const kind of ["milestone", "cycle", "module"] as const) {
    it(`reads only ${kind} work and its open blockers, preserving existing progress`, async () => {
      const create = { milestone: createMilestone, cycle: createCycle, module: createModule }[kind];
      const item = await create({ projectId, name: kind, description: "Goal" });
      const first = await createIssue({ projectId, title: `${kind} foundation`, type: "epic" });
      const second = await createIssue({ projectId, title: `${kind} dependent`, parentId: first.id });
      const archived = await createIssue({ projectId, title: "Archived" });
      await createIssue({ projectId, title: "Not assigned" });
      for (const i of [first, second, archived]) {
        await assignIssue(i.id, kind === "module" ? { moduleIds: [item.id] } : { [`${kind}Id`]: item.id });
      }
      await setIssueArchived(archived.id, true);
      await addRelation(first.id, { relatedIssueId: second.id, type: "blocks" });
      const detail = await getPlanningDetail(projectId, kind, item.id);
      expect(detail?.item).toMatchObject({ name: kind, description: "Goal", progress: { total: 2, completed: 0 } });
      expect(detail?.issues.map((i) => i.id).sort()).toEqual([first.id, second.id].sort());
      expect(detail?.issues.find((i) => i.id === second.id)?.blockers).toEqual([
        expect.objectContaining({ id: first.id, title: `${kind} foundation` }),
      ]);
      expect(await getPlanningDetail(otherId, kind, item.id)).toBeNull();
      const done = (await listStates(projectId)).find((s) => s.group === "completed")!;
      await updateIssue(first.id, { stateId: done.id });
      const completed = await getPlanningDetail(projectId, kind, item.id);
      expect(completed?.issues.find((i) => i.id === second.id)?.blockers).toEqual([]);
      expect(completed?.item.progress.completed).toBe(1);
    });
  }
  it("returns empty work for an unassigned milestone and null for missing ids", async () => {
    const item = await createMilestone({ projectId, name: "Empty" });
    expect((await getPlanningDetail(projectId, "milestone", item.id))?.issues).toEqual([]);
    expect(await getPlanningDetail(projectId, "milestone", "missing")).toBeNull();
  });
});
