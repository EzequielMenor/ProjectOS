import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { callTool } from "@/server/agent/tools";
import { createBackup, restoreBackup } from "@/server/services/backup";
import { createProject } from "@/server/services/projects";
import { authenticate, createToken } from "@/server/services/tokens";

process.env.BACKUP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "projectos-plan-"));
let ctx: Awaited<ReturnType<typeof authenticate>>;
const call = (n: string, a: unknown) => callTool(n, a, ctx) as Promise<any>;

beforeAll(async () => {
  await createProject({ identifier: "PLN", name: "Plan" });
  await createProject({ identifier: "OTH", name: "Otro" });
  ctx = await authenticate(`Bearer ${(await createToken({ name: "t", scope: "write" })).token}`);
});

describe("cycles, modules and milestones", () => {
  it("tracks progress by state group and supports many modules per issue", async () => {
    await call("create_cycle", { project: "PLN", name: "Sprint 1", startDate: "2026-11-01", endDate: "2026-11-14" });
    await call("create_module", { project: "PLN", name: "A · Base", status: "in_progress" });
    await call("create_module", { project: "PLN", name: "B · Fichajes" });
    await call("create_milestone", { project: "PLN", name: "v1.0", targetDate: "2026-12-01" });
    const keys: string[] = [];
    for (const t of ["uno", "dos", "tres"]) keys.push((await call("create_issue", { project: "PLN", title: t })).key);
    await call("assign_issue", { key: keys[0], cycle: "Sprint 1", milestone: "v1.0", modules: ["A · Base", "B · Fichajes"] });
    await call("assign_issue", { key: keys[1], cycle: "sprint 1", modules: ["A · Base"] });
    await call("assign_issue", { key: keys[2], cycle: "Sprint 1" });
    await call("complete_issue", { key: keys[0] });
    await call("set_state", { key: keys[1], state: "In Progress" });

    const cycles = await call("list_cycles", { project: "PLN" });
    expect(cycles[0].progress).toEqual({ total: 3, completed: 1, started: 1, cancelled: 0 });
    expect(cycles[0].percentDone).toBe(33);
    const mods = await call("list_modules", { project: "PLN" });
    expect(mods.find((m: any) => m.name === "A · Base").progress.total).toBe(2);
    expect(mods.find((m: any) => m.name === "B · Fichajes").progress.completed).toBe(1);
    expect((await call("list_milestones", { project: "PLN" }))[0].percentDone).toBe(100);

    const got = await call("get_issue", { key: keys[0] });
    expect(got).toMatchObject({ cycle: "Sprint 1", milestone: "v1.0", modules: ["A · Base", "B · Fichajes"] });
    // replacing the module set and clearing the cycle
    await call("assign_issue", { key: keys[0], cycle: null, modules: ["B · Fichajes"] });
    const again = await call("get_issue", { key: keys[0] });
    expect(again.cycle).toBeNull();
    expect(again.modules).toEqual(["B · Fichajes"]);
  });

  it("rejects duplicates, bad ranges, unknown names and cross-project items", async () => {
    await expect(call("create_cycle", { project: "PLN", name: "Sprint 1" })).rejects.toThrow(/Ya existe/);
    await expect(call("create_cycle", { project: "PLN", name: "X", startDate: "2026-12-10", endDate: "2026-12-01" })).rejects.toThrow(/anterior/);
    const { key } = await call("create_issue", { project: "OTH", title: "ajena" });
    await expect(call("assign_issue", { key, cycle: "Sprint 1" })).rejects.toThrow(/no existe/);
    const other = (await call("list_projects", {})).find((p: any) => p.identifier === "OTH");
    expect(other).toBeTruthy();
  });

  it("round-trips through backup, and old backups without these tables still restore", async () => {
    const b = await createBackup();
    expect(b.counts.cycle).toBe(1);
    expect(b.counts.issue_module).toBeGreaterThan(0);
    await restoreBackup(b, { replace: true });
    expect(await createBackup().then((x) => x.tables)).toEqual(b.tables);

    const old = JSON.parse(JSON.stringify(b));
    for (const t of ["cycle", "module", "milestone", "issue_module"]) {
      delete old.tables[t];
      delete old.counts[t];
    }
    old.tables.issue = old.tables.issue.map((i: any) => ({ ...i, cycleId: null, milestoneId: null }));
    const res = await restoreBackup(old, { replace: true });
    expect(res.counts.cycle).toBe(0);
    const after = await createBackup();
    expect(after.counts.cycle).toBe(0);
    expect(after.counts.issue).toBe(b.counts.issue);
  });
});
