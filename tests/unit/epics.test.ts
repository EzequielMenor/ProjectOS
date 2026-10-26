import { beforeAll, describe, expect, it } from "vitest";
import { callTool } from "@/server/agent/tools";
import { childProgress, listEpics } from "@/server/services/epics";
import { createProject } from "@/server/services/projects";
import { authenticate, createToken } from "@/server/services/tokens";

let ctx: Awaited<ReturnType<typeof authenticate>>;
let projectId: string;
const call = (n: string, a: unknown) => callTool(n, a, ctx) as Promise<any>;

beforeAll(async () => {
  projectId = (await createProject({ identifier: "EPC", name: "Epicas" })).id;
  await createProject({ identifier: "EPD", name: "Otro" });
  ctx = await authenticate(`Bearer ${(await createToken({ name: "t", scope: "write" })).token}`);
});

describe("epics", () => {
  it("computes progress from direct sub-issues, ignoring archived and cancelled ones", async () => {
    const epic = await call("create_issue", { project: "EPC", title: "Release 1", type: "epic" });
    const keys: string[] = [];
    for (const t of ["a", "b", "c", "d", "e"]) keys.push((await call("create_issue", { project: "EPC", title: t, parent: epic.key })).key);
    await call("complete_issue", { key: keys[0] });
    await call("complete_issue", { key: keys[1] });
    await call("set_state", { key: keys[2], state: "In Progress" });
    await call("set_state", { key: keys[3], state: "Cancelled" });
    await call("archive_issue", { key: keys[4] });
    // a grandchild is not a direct child and must not count
    const grand = await call("create_issue", { project: "EPC", title: "nieta", parent: keys[2] });
    await call("complete_issue", { key: grand.key });

    const epics = await listEpics(projectId);
    expect(epics).toHaveLength(1);
    expect(epics[0]).toMatchObject({ key: epic.key, title: "Release 1", progress: { total: 4, completed: 2, started: 1, cancelled: 1 } });
    expect(epics[0].children.map((c) => c.key)).toEqual(keys.slice(0, 4));

    const [row] = await call("list_epics", { project: "EPC" });
    expect(row).toMatchObject({ key: epic.key, state: "Todo", progress: { total: 4, completed: 2, percentDone: 67 }, children: keys.slice(0, 4) });
    expect((await call("get_issue", { key: epic.key })).childProgress).toMatchObject({ total: 4, completed: 2 });
    expect((await call("get_issue", { key: keys[0] })).childProgress).toBeNull();
  });

  it("only lists epics, per project, and excludes archived epics; plain issues with children are not epics", async () => {
    const plain = await call("create_issue", { project: "EPC", title: "padre normal" });
    await call("create_issue", { project: "EPC", title: "hijo", parent: plain.key });
    const other = await call("create_issue", { project: "EPD", title: "épica ajena", type: "epic" });
    expect((await call("list_epics", { project: "EPC" })).map((e: any) => e.title)).toEqual(["Release 1"]);
    expect((await call("list_epics", { project: "EPD" })).map((e: any) => e.key)).toEqual([other.key]);

    const tmp = await call("create_issue", { project: "EPC", title: "Temporal", type: "epic" });
    expect((await call("list_epics", { project: "EPC" })).map((e: any) => e.title)).toContain("Temporal");
    await call("archive_issue", { key: tmp.key });
    expect((await call("list_epics", { project: "EPC" })).map((e: any) => e.title)).not.toContain("Temporal");
  });

  it("an issue can be turned into an epic and back, and next_work never offers epics", async () => {
    const i = await call("create_issue", { project: "EPC", title: "conviértela" });
    await call("update_issue", { key: i.key, type: "epic" });
    expect((await call("list_epics", { project: "EPC" })).map((e: any) => e.key)).toContain(i.key);
    expect((await call("next_work", { project: "EPC", limit: 20 })).map((n: any) => n.key)).not.toContain(i.key);
    await call("update_issue", { key: i.key, type: "issue" });
    expect((await call("list_epics", { project: "EPC" })).map((e: any) => e.key)).not.toContain(i.key);
  });

  it("childProgress with no ids is empty", async () => {
    expect((await childProgress([])).size).toBe(0);
  });
});
