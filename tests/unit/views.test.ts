import { beforeAll, describe, expect, it } from "vitest";
import { applyFilters, parseFilters, serializeFilters } from "@/lib/issue-filters";
import type { IssueDTO } from "@/server/dto";
import { createBackup, restoreBackup } from "@/server/services/backup";
import { createProject } from "@/server/services/projects";
import { createView, deleteView, listViews } from "@/server/services/views";

const issue = (o: Partial<IssueDTO>): IssueDTO => ({
  id: "i", key: "X-1", seq: 1, title: "t", type: "issue", stateId: "s1", priority: "none", parentId: null, assigneeId: null,
  estimate: null, dueDate: null, cycleId: null, milestoneId: null, moduleIds: [], sortOrder: 0, labels: [], properties: {}, ...o,
});

describe("issue filters", () => {
  it("round-trips through the URL and combines with AND across fields, OR within one", () => {
    const f = parseFilters(new URLSearchParams("state=s1,s2&priority=urgent,high&q=login"));
    expect(serializeFilters(f)).toBe("state=s1%2Cs2&priority=urgent%2Chigh&q=login");
    const rows = [
      issue({ id: "a", title: "Arreglar login", stateId: "s1", priority: "urgent" }),
      issue({ id: "b", title: "Arreglar login", stateId: "s3", priority: "urgent" }),
      issue({ id: "c", title: "Otra cosa", stateId: "s2", priority: "high" }),
      issue({ id: "d", key: "X-9", title: "Login", stateId: "s2", priority: "low" }),
    ];
    expect(applyFilters(rows, f).map((r) => r.id)).toEqual(["a"]);
    expect(applyFilters(rows, parseFilters(new URLSearchParams("q=x-9"))).map((r) => r.id)).toEqual(["d"]);
    expect(applyFilters(rows, parseFilters(new URLSearchParams(""))).length).toBe(4);
  });

  it("filters by label, cycle and module", () => {
    const rows = [
      issue({ id: "a", labels: [{ id: "l1", name: "x", color: "#000000" }], cycleId: "c1", moduleIds: ["m1", "m2"] }),
      issue({ id: "b", cycleId: "c2", moduleIds: ["m2"] }),
      issue({ id: "c" }),
    ];
    const ids = (qs: string) => applyFilters(rows, parseFilters(new URLSearchParams(qs))).map((r) => r.id);
    expect(ids("label=l1")).toEqual(["a"]);
    expect(ids("cycle=c1,c2")).toEqual(["a", "b"]);
    expect(ids("module=m2")).toEqual(["a", "b"]);
    expect(ids("module=m1&cycle=c2")).toEqual([]);
  });
});

describe("saved views", () => {
  let projectId: string;
  beforeAll(async () => {
    projectId = (await createProject({ identifier: "VWS", name: "Views" })).id;
  });

  it("stores only known filter keys, rejects duplicate names, and survives backup/restore", async () => {
    const v = await createView({ projectId, name: "Urgentes", layout: "table", query: "?priority=urgent&evil=1&state=" });
    expect(v.query).toBe("priority=urgent");
    await expect(createView({ projectId, name: "Urgentes" })).rejects.toMatchObject({ code: "conflict" });
    const before = await createBackup();
    expect(before.counts.saved_view).toBe(1);
    await restoreBackup(before, { replace: true });
    expect((await listViews(projectId)).map((x) => x.name)).toEqual(["Urgentes"]);
    await deleteView(v.id, projectId);
    expect(await listViews(projectId)).toEqual([]);
    await expect(deleteView(v.id, projectId)).rejects.toMatchObject({ code: "not_found" });
  });
});
