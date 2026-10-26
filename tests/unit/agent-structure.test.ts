import { beforeAll, describe, expect, it } from "vitest";
import { callTool } from "@/server/agent/tools";
import { createProject } from "@/server/services/projects";
import { authenticate, createToken } from "@/server/services/tokens";

type Ctx = Awaited<ReturnType<typeof authenticate>>;
let rw: Ctx;
let ro: Ctx;
const call = (name: string, args: unknown, ctx = rw) => callTool(name, args, ctx) as Promise<any>;

beforeAll(async () => {
  await createProject({ identifier: "STR", name: "Estructura" });
  rw = await authenticate(`Bearer ${(await createToken({ name: "claude-code", scope: "write" })).token}`);
  ro = await authenticate(`Bearer ${(await createToken({ name: "lector", scope: "read" })).token}`);
});

describe("agents can create structure and edit planning", () => {
  it("creates a project with the default workflow and a custom state", async () => {
    expect(await call("create_project", { identifier: "NEW", name: "Nuevo", description: "creado por un agente" })).toEqual({ identifier: "NEW", name: "Nuevo" });
    await expect(call("create_project", { identifier: "NEW", name: "Otra vez" })).rejects.toThrow(/Ya existe/);
    await call("create_state", { project: "NEW", name: "In Review", group: "started" });
    const p = await call("get_project", { project: "NEW" });
    expect(p.states.map((s: any) => s.name)).toEqual(["Backlog", "Todo", "In Progress", "Done", "Cancelled", "In Review"]);
    await expect(call("create_state", { project: "NEW", name: "in review", group: "started" })).rejects.toThrow(/Ya existe/);
    const issue = await call("create_issue", { project: "NEW", title: "usa el estado nuevo" });
    await call("set_state", { key: issue.key, state: "In Review" });
    expect((await call("get_issue", { key: issue.key })).state).toBe("In Review");
  });

  it("edits cycles, modules and milestones by name", async () => {
    await call("create_cycle", { project: "STR", name: "Sprint 1", startDate: "2026-11-01", endDate: "2026-11-14" });
    await call("update_cycle", { project: "STR", name: "sprint 1", newName: "Sprint uno", endDate: "2026-11-21" });
    expect((await call("list_cycles", { project: "STR" })).map((c: any) => [c.name, c.endDate])).toEqual([["Sprint uno", "2026-11-21"]]);
    await expect(call("update_cycle", { project: "STR", name: "Sprint uno", endDate: "2026-10-01" })).rejects.toThrow(/anterior/);
    await expect(call("update_cycle", { project: "STR", name: "Sprint uno" })).rejects.toThrow(/nada que cambiar/);
    await expect(call("update_cycle", { project: "STR", name: "No existe", newName: "x" })).rejects.toThrow(/Válidos: Sprint uno/);

    await call("create_module", { project: "STR", name: "Auth" });
    await call("update_module", { project: "STR", name: "Auth", status: "in_progress", targetDate: "2026-12-01" });
    const m = (await call("list_modules", { project: "STR" }))[0];
    expect([m.status, m.targetDate]).toEqual(["in_progress", "2026-12-01"]);
    await call("update_module", { project: "STR", name: "Auth", targetDate: null });
    expect((await call("list_modules", { project: "STR" }))[0].targetDate).toBeNull();

    await call("create_milestone", { project: "STR", name: "Beta", targetDate: "2027-01-10" });
    await call("update_milestone", { project: "STR", name: "Beta", newName: "Beta pública", description: "abierta a todos" });
    const ms = (await call("list_milestones", { project: "STR" }))[0];
    expect([ms.name, ms.targetDate]).toEqual(["Beta pública", "2027-01-10"]);
    await call("update_milestone", { project: "STR", name: "Beta pública", targetDate: null });
    expect((await call("list_milestones", { project: "STR" }))[0].targetDate).toBeNull();
  });

  it("read tokens cannot use the new write tools", async () => {
    for (const [n, a] of [["create_project", { identifier: "ZZ", name: "z" }], ["create_state", { project: "STR", name: "x", group: "started" }], ["update_cycle", { project: "STR", name: "a", newName: "b" }]] as const) {
      await expect(call(n, a, ro)).rejects.toThrow(/solo lectura/);
    }
  });
});
