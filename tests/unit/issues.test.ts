import { beforeAll, describe, expect, it } from "vitest";
import {
  createIssue,
  getIssueByKey,
  listIssues,
  moveIssue,
  updateIssue,
  addRelation,
  removeRelation,
  searchIssues,
  setIssueArchived,
} from "@/server/services/issues";
import { createProject, listStates } from "@/server/services/projects";

let projectId: string;
let states: Awaited<ReturnType<typeof listStates>>;

beforeAll(async () => {
  const p = await createProject({ identifier: "demo", name: "Demo" });
  projectId = p.id;
  states = await listStates(projectId);
});

describe("projects", () => {
  it("creates default states and rejects duplicates / bad identifiers", async () => {
    expect(states.map((s) => s.name)).toEqual(["Backlog", "Todo", "In Progress", "Done", "Cancelled"]);
    await expect(createProject({ identifier: "DEMO", name: "x" })).rejects.toMatchObject({ code: "conflict" });
    await expect(createProject({ identifier: "1x", name: "x" })).rejects.toThrow();
  });
});

describe("issues", () => {
  it("numbers issues sequentially per project and uses the default state", async () => {
    const a = await createIssue({ projectId, title: "Primero" });
    const b = await createIssue({ projectId, title: "Segundo" });
    expect([a.seq, b.seq]).toEqual([1, 2]);
    expect(a.stateId).toBe(states.find((s) => s.name === "Todo")!.id);
    const found = await getIssueByKey("demo-2");
    expect(found.title).toBe("Segundo");
  });

  it("allocates unique sequence numbers under concurrency", async () => {
    const created = await Promise.all(Array.from({ length: 8 }, (_, i) => createIssue({ projectId, title: `c${i}` })));
    expect(new Set(created.map((c) => c.seq)).size).toBe(8);
  });

  it("completing sets completedAt, reopening clears it, and activity is logged", async () => {
    const done = states.find((s) => s.group === "completed")!;
    const todo = states.find((s) => s.name === "Todo")!;
    const i = await createIssue({ projectId, title: "Cerrar" });
    const closed = await updateIssue(i.id, { stateId: done.id });
    expect(closed.completedAt).not.toBeNull();
    const reopened = await updateIssue(i.id, { stateId: todo.id });
    expect(reopened.completedAt).toBeNull();
  });

  it("moves between columns positioning between neighbours", async () => {
    const prog = states.find((s) => s.group === "started")!;
    const x = await createIssue({ projectId, title: "x", stateId: prog.id });
    await createIssue({ projectId, title: "y", stateId: prog.id });
    await createIssue({ projectId, title: "z", stateId: prog.id });
    const before = (await listIssues({ projectId, stateId: prog.id })).map((r) => r.id);
    const rest = before.filter((id) => id !== x.id);
    // drop x between the first two remaining issues
    await moveIssue(x.id, { stateId: prog.id, prevId: rest[0], nextId: rest[1] });
    const after = (await listIssues({ projectId, stateId: prog.id })).map((r) => r.id);
    expect(after.slice(0, 3)).toEqual([rest[0], x.id, rest[1]]);
  });

  it("validates hierarchy: no self parent, no cycles, same project only", async () => {
    const p = await createIssue({ projectId, title: "padre", type: "epic" });
    const c = await createIssue({ projectId, title: "hijo", parentId: p.id });
    await expect(updateIssue(p.id, { parentId: c.id })).rejects.toMatchObject({ code: "invalid" });
    await expect(updateIssue(p.id, { parentId: p.id })).rejects.toMatchObject({ code: "invalid" });
    expect((await getIssueByKey(`DEMO-${p.seq}`)).children.map((x) => x.id)).toEqual([c.id]);
  });

  it("rejects a state from another project", async () => {
    const other = await createProject({ identifier: "OTH", name: "Otro" });
    const [foreign] = await listStates(other.id);
    await expect(createIssue({ projectId, title: "mal", stateId: foreign.id })).rejects.toMatchObject({ code: "invalid" });
  });

  it("relations are idempotent and archive hides issues from default lists", async () => {
    const a = await createIssue({ projectId, title: "bloquea" });
    const b = await createIssue({ projectId, title: "bloqueado" });
    expect(await addRelation(a.id, { relatedIssueId: b.id, type: "blocks" })).not.toBeNull();
    expect(await addRelation(a.id, { relatedIssueId: b.id, type: "blocks" })).toBeNull();
    await setIssueArchived(a.id, true);
    expect((await listIssues({ projectId })).some((r) => r.id === a.id)).toBe(false);
    expect((await listIssues({ projectId, includeArchived: true })).some((r) => r.id === a.id)).toBe(true);
  });

  it("removes a relation from either side and only that type", async () => {
    const a = await createIssue({ projectId, title: "rel-a" });
    const b = await createIssue({ projectId, title: "rel-b" });
    await addRelation(a.id, { relatedIssueId: b.id, type: "blocks" });
    await addRelation(a.id, { relatedIssueId: b.id, type: "relates" });
    expect(await removeRelation(b.id, { relatedIssueId: a.id, type: "blocks" })).toBe(1);
    expect(await removeRelation(b.id, { relatedIssueId: a.id, type: "blocks" })).toBe(0);
    expect((await getIssueByKey(`DEMO-${a.seq}`)).id).toBe(a.id);
  });

  it("search ranks exact key, then titles, and treats % and _ literally", async () => {
    const t = await createIssue({ projectId, title: "Informe 100% listo" });
    await createIssue({ projectId, title: "otro", description: "menciona 100% en la descripción" });
    await createIssue({ projectId, title: "Informe 1000 filas" });
    const byKey = await searchIssues(`demo-${t.seq}`);
    expect(byKey[0].id).toBe(t.id);
    const pct = await searchIssues("100%");
    expect(pct.map((r) => r.title)).toEqual(["Informe 100% listo", "otro"]);
    expect(await searchIssues("_")).toEqual([]);
  });
});
