import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createBackup, restoreBackup } from "@/server/services/backup";
import { createIssue, getIssue, updateIssue } from "@/server/services/issues";
import { createProject, listStates } from "@/server/services/projects";
import { createState, deleteState, moveState, setDefaultState, updateState } from "@/server/services/states";

process.env.BACKUP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "projectos-states-"));
let pid: string;
let otherPid: string;
const names = async (id = pid) => (await listStates(id)).map((s) => s.name);

beforeAll(async () => {
  pid = (await createProject({ identifier: "STA", name: "Estados" })).id;
  otherPid = (await createProject({ identifier: "STB", name: "Otro" })).id;
});

describe("workflow states", () => {
  it("creates, renames and recolours states, rejecting duplicates and bad colours", async () => {
    const review = await createState({ projectId: pid, name: "In Review", group: "started", color: "#8b5cf6" });
    expect((await names()).at(-1)).toBe("In Review");
    await updateState(review.id, { name: "Revisión", color: "#0ea5e9" });
    expect(await names()).toContain("Revisión");
    await expect(createState({ projectId: pid, name: "revisión", group: "started", color: "#000000" })).rejects.toThrow(/Ya existe/);
    await expect(createState({ projectId: pid, name: "X", group: "started", color: "rojo" })).rejects.toThrow();
    // same name in another project is fine
    await createState({ projectId: otherPid, name: "Revisión", group: "started", color: "#000000" });
  });

  it("reorders, including when positions are tied, and is a no-op at the ends", async () => {
    const before = await listStates(pid);
    await moveState(before[0].id, "up");
    expect(await names()).toEqual(before.map((s) => s.name));
    await moveState(before[2].id, "up");
    const after = await names();
    expect(after.slice(0, 3)).toEqual([before[0].name, before[2].name, before[1].name]);
    expect(new Set((await listStates(pid)).map((s) => s.position)).size).toBe(before.length);
  });

  it("keeps exactly one default state", async () => {
    const inProgress = (await listStates(pid)).find((s) => s.name === "In Progress")!;
    await setDefaultState(inProgress.id);
    const defaults = (await listStates(pid)).filter((s) => s.isDefault);
    expect(defaults.map((s) => s.name)).toEqual(["In Progress"]);
    await setDefaultState((await listStates(pid)).find((s) => s.name === "Todo")!.id);
  });

  it("changing a state's group keeps completedAt consistent, and the last 'completed' state is protected", async () => {
    const done = (await listStates(pid)).find((s) => s.group === "completed")!;
    const cancelled = (await listStates(pid)).find((s) => s.group === "cancelled")!;
    const i = await createIssue({ projectId: pid, title: "cerrada" });
    await updateIssue(i.id, { stateId: done.id });
    expect((await getIssue(i.id)).completedAt).not.toBeNull();
    await expect(updateState(done.id, { group: "started" })).rejects.toThrow(/completed/);
    await expect(deleteState(done.id, { moveIssuesTo: cancelled.id })).rejects.toThrow(/completed/);

    // with a second completed state the first can change group, and its issues stop counting as completed
    const shipped = await createState({ projectId: pid, name: "Shipped", group: "completed", color: "#10b981" });
    await updateState(done.id, { group: "started" });
    expect((await getIssue(i.id)).completedAt).toBeNull();
    await updateState(done.id, { group: "completed" });
    expect((await getIssue(i.id)).completedAt).not.toBeNull();
    await deleteState(shipped.id, { moveIssuesTo: done.id });
  });

  it("deleting needs a destination in the same project, moves the issues and refuses the default", async () => {
    const states = await listStates(pid);
    const todo = states.find((s) => s.isDefault)!;
    const review = states.find((s) => s.name === "Revisión")!;
    const done = states.find((s) => s.group === "completed")!;
    const i = await createIssue({ projectId: pid, title: "en revisión" });
    await updateIssue(i.id, { stateId: review.id });

    await expect(deleteState(todo.id, { moveIssuesTo: review.id })).rejects.toThrow(/por defecto/);
    await expect(deleteState(review.id, { moveIssuesTo: review.id })).rejects.toThrow(/otro/);
    const foreign = (await listStates(otherPid))[0];
    await expect(deleteState(review.id, { moveIssuesTo: foreign.id })).rejects.toThrow(/otro proyecto/);
    await expect(deleteState(review.id, {} as never)).rejects.toThrow();

    const res = await deleteState(review.id, { moveIssuesTo: done.id });
    expect(res.moved).toBe(1);
    expect(await names()).not.toContain("Revisión");
    const moved = await getIssue(i.id);
    expect(moved.stateId).toBe(done.id);
    expect(moved.completedAt).not.toBeNull();
  });

  it("round-trips through backup", async () => {
    const b = await createBackup();
    await restoreBackup(b, { replace: true });
    expect((await createBackup()).tables.state).toEqual(b.tables.state);
  });
});
