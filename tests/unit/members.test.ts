import { beforeAll, describe, expect, it } from "vitest";
import { applyFilters, NO_ASSIGNEE, parseFilters, serializeFilters } from "@/lib/issue-filters";
import { callTool, TOOLS } from "@/server/agent/tools";
import { toIssueDTO } from "@/server/dto";
import { createBackup, restoreBackup } from "@/server/services/backup";
import { createIssue, getIssueByKey, listActivity, listIssues, updateIssue } from "@/server/services/issues";
import { createMember, deleteMember, listMembersWithCounts, updateMember } from "@/server/services/members";
import { createProject } from "@/server/services/projects";
import { authenticate, createToken } from "@/server/services/tokens";
import { listMembers } from "@/server/services/workspace";

let ctx: Awaited<ReturnType<typeof authenticate>>;
let ro: Awaited<ReturnType<typeof authenticate>>;
let projectId: string;
const call = (n: string, a: unknown, c = ctx) => callTool(n, a, c) as Promise<any>;

beforeAll(async () => {
  projectId = (await createProject({ identifier: "MEM", name: "Miembros" })).id;
  ctx = await authenticate(`Bearer ${(await createToken({ name: "claude-code", scope: "write" })).token}`);
  ro = await authenticate(`Bearer ${(await createToken({ name: "lector", scope: "read" })).token}`);
});

describe("members", () => {
  it("starts with the workspace owner; names are unique (case-insensitive) and can be renamed", async () => {
    const initial = await listMembers();
    expect(initial.map((m) => m.name)).toEqual(["Yo"]);
    const ana = await createMember({ name: "  Ana ", kind: "human" });
    expect(ana.name).toBe("Ana");
    await expect(createMember({ name: "ana" })).rejects.toThrow(/Ya hay un miembro/);
    await expect(createMember({ name: "   " })).rejects.toThrow();
    const bot = await createMember({ name: "Claude", kind: "agent" });
    expect(bot.kind).toBe("agent");
    await expect(updateMember(bot.id, { name: "ANA" })).rejects.toThrow(/Ya hay un miembro/);
    expect((await updateMember(bot.id, { name: "Claude Code" })).name).toBe("Claude Code");
    await expect(updateMember(crypto.randomUUID(), { name: "Nadie" })).rejects.toThrow(/no encontrado/);
  });

  it("assigns on create and update, rejects unknown ids, and logs names in the activity", async () => {
    const [ana, cc] = [await mustMember("Ana"), await mustMember("Claude Code")];
    const i = await createIssue({ projectId, title: "Con dueña", assigneeId: ana.id });
    expect(i.assigneeId).toBe(ana.id);
    await expect(createIssue({ projectId, title: "Mal", assigneeId: crypto.randomUUID() })).rejects.toThrow(/no existe/);
    await expect(updateIssue(i.id, { assigneeId: crypto.randomUUID() })).rejects.toThrow(/no existe/);

    await updateIssue(i.id, { assigneeId: cc.id });
    await updateIssue(i.id, { assigneeId: null });
    const changes = (await listActivity(i.id))
      .filter((a) => a.action === "issue.updated")
      .map((a) => (a.data as { changes: Record<string, { from: unknown; to: unknown }> }).changes.assignee);
    expect(changes).toHaveLength(2);
    expect(changes).toEqual(expect.arrayContaining([
      { from: "Ana", to: "Claude Code" },
      { from: "Claude Code", to: null },
    ]));
    // setting the same assignee again is not a change
    await updateIssue(i.id, { assigneeId: null });
    expect((await listActivity(i.id)).filter((a) => a.action === "issue.updated")).toHaveLength(2);
  });

  it("counts issues per member and deleting one unassigns its issues without touching them", async () => {
    const temp = await createMember({ name: "Temporal" });
    const a = await createIssue({ projectId, title: "De temporal 1", assigneeId: temp.id });
    await createIssue({ projectId, title: "De temporal 2", assigneeId: temp.id });
    expect((await listMembersWithCounts()).find((m) => m.id === temp.id)?.issues).toBe(2);
    expect(await deleteMember(temp.id)).toEqual({ unassigned: 2 });
    expect((await listMembers()).some((m) => m.id === temp.id)).toBe(false);
    const after = await getIssueByKey(`MEM-${a.seq}`);
    expect(after.assigneeId).toBeNull();
    expect(after.title).toBe("De temporal 1");
    await expect(deleteMember(temp.id)).rejects.toThrow(/no encontrado/);
  });
});

describe("assignee filter", () => {
  it("parses from the URL, round-trips, and treats «sin asignar» as its own choice", async () => {
    const ana = await mustMember("Ana");
    const mine = await createIssue({ projectId, title: "Filtro: de Ana", assigneeId: ana.id });
    const nobody = await createIssue({ projectId, title: "Filtro: de nadie" });
    const dtos = (await listIssues({ projectId })).map((r) => toIssueDTO(r, "MEM"));

    const f = parseFilters(new URLSearchParams(`assignee=${ana.id}`));
    expect(f.assignee).toEqual([ana.id]);
    expect(serializeFilters(f)).toBe(`assignee=${ana.id}`);
    const keys = (fs: ReturnType<typeof parseFilters>) => applyFilters(dtos, fs).map((i) => i.seq);
    expect(keys(f)).toContain(mine.seq);
    expect(keys(f)).not.toContain(nobody.seq);

    const none = parseFilters(new URLSearchParams(`assignee=${NO_ASSIGNEE}`));
    expect(keys(none)).toContain(nobody.seq);
    expect(keys(none)).not.toContain(mine.seq);

    const both = parseFilters(new URLSearchParams(`assignee=${NO_ASSIGNEE},${ana.id}`));
    expect(keys(both)).toEqual(expect.arrayContaining([mine.seq, nobody.seq]));
  });
});

describe("agent tools for members", () => {
  it("list_members / create_member; read tokens cannot create; there is no delete tool", async () => {
    expect(TOOLS.filter((t) => /member/.test(t.name) && /delete|remove|destroy/.test(t.name))).toEqual([]);
    const names = (await call("list_members", {}, ro)).map((m: any) => m.name);
    expect(names).toEqual(expect.arrayContaining(["Yo", "Ana", "Claude Code"]));
    await expect(call("create_member", { name: "Intruso" }, ro)).rejects.toThrow(/solo lectura/);
    expect(await call("create_member", { name: "Codex" })).toEqual({ name: "Codex", kind: "agent" });
    await expect(call("create_member", { name: "codex" })).rejects.toThrow(/Ya hay un miembro/);
  });

  it("assigns by name on create/update, clears with null, and filters list_issues and next_work", async () => {
    const created = await call("create_issue", { project: "MEM", title: "Tarea del agente", assignee: "claude code" });
    expect((await call("get_issue", { key: created.key })).assignee).toBe("Claude Code");

    await expect(call("create_issue", { project: "MEM", title: "x", assignee: "Fantasma" })).rejects.toThrow(/Válidos/);
    await expect(call("update_issue", { key: created.key, assignee: "Fantasma" })).rejects.toThrow(/no existe/);

    const mine = await call("list_issues", { project: "MEM", assignee: "Claude Code" });
    expect(mine.map((i: any) => i.key)).toEqual([created.key]);
    expect((await call("next_work", { project: "MEM", assignee: "Claude Code" })).map((i: any) => i.key)).toEqual([created.key]);
    expect(await call("next_work", { project: "MEM", assignee: "Codex" })).toEqual([]);

    await call("update_issue", { key: created.key, assignee: "Ana" });
    expect((await call("get_issue", { key: created.key })).assignee).toBe("Ana");
    await call("update_issue", { key: created.key, assignee: null });
    expect((await call("get_issue", { key: created.key })).assignee).toBeNull();
    expect(await call("list_issues", { project: "MEM", assignee: "Claude Code" })).toEqual([]);

    const act = (await listActivity((await getIssueByKey(created.key)).id)).at(0)!;
    expect(act.actor).toBe("agent:claude-code");
  });
});

describe("backup", () => {
  it("keeps members and assignments through a restore", async () => {
    const ana = await mustMember("Ana");
    const issue = await createIssue({ projectId, title: "Sobrevive", assigneeId: ana.id });
    const backup = await createBackup();
    await updateIssue(issue.id, { assigneeId: null });
    await restoreBackup(backup, { replace: true });
    const back = await getIssueByKey(`MEM-${issue.seq}`);
    expect(back.assigneeId).toBe(ana.id);
    expect(back.assignee?.name).toBe("Ana");
  });
});

async function mustMember(name: string) {
  const m = (await listMembers()).find((x) => x.name === name);
  if (!m) throw new Error(`falta el miembro ${name}`);
  return m;
}
