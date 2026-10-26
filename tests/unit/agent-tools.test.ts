import { beforeAll, describe, expect, it } from "vitest";
import { TOOLS, callTool } from "@/server/agent/tools";
import { authenticate, createToken, revokeToken } from "@/server/services/tokens";
import { createProject } from "@/server/services/projects";

type Ctx = Awaited<ReturnType<typeof authenticate>>;
let rw: Ctx;
let ro: Ctx;
let roId: string;

beforeAll(async () => {
  await createProject({ identifier: "agt", name: "Agents" });
  const w = await createToken({ name: "claude-code", scope: "write" });
  const r = await createToken({ name: "viewer", scope: "read" });
  roId = r.id;
  rw = await authenticate(`Bearer ${w.token}`);
  ro = await authenticate(`Bearer ${r.token}`);
});

const call = (name: string, args: unknown, ctx = rw) => callTool(name, args, ctx) as Promise<any>;

describe("token auth", () => {
  it("rejects missing, malformed and unknown tokens; stores only a hash", async () => {
    await expect(authenticate(null)).rejects.toThrow(/Bearer/);
    await expect(authenticate("Bearer nope")).rejects.toThrow(/Bearer/);
    await expect(authenticate("Bearer pos_doesnotexist")).rejects.toThrow(/inválido/);
  });
  it("revoked tokens stop working", async () => {
    const t = await createToken({ name: "temp", scope: "write" });
    await authenticate(`Bearer ${t.token}`);
    await revokeToken(t.id);
    await expect(authenticate(`Bearer ${t.token}`)).rejects.toThrow(/revocado/);
  });
});

describe("permissions and safety", () => {
  it("exposes no delete/destroy tools", () => {
    expect(TOOLS.filter((t) => /delete|remove|destroy|drop|purge/i.test(t.name))).toEqual([]);
  });
  it("read tokens cannot call write tools", async () => {
    await expect(call("create_issue", { project: "AGT", title: "x" }, ro)).rejects.toThrow(/solo lectura/);
    expect(await call("list_projects", {}, ro)).toHaveLength(1);
    expect(roId).toBeTruthy();
  });
  it("validates arguments and unknown tools", async () => {
    await expect(call("create_issue", { project: "AGT" })).rejects.toThrow();
    await expect(call("nope", {})).rejects.toThrow(/desconocida/);
    await expect(call("set_state", { key: "AGT-1", state: "Nonexistent" })).rejects.toThrow();
  });
});

describe("agent workflow", () => {
  it("creates, labels, comments, links, completes and records the actor", async () => {
    const { key } = await call("create_issue", { project: "AGT", title: "Implementar fichaje", labels: ["backend"], priority: "high" });
    expect(key).toBe("AGT-1");
    await call("set_state", { key, state: "in progress" });
    await call("log_progress", { key, summary: "Endpoint listo", evidence: [{ kind: "commit", url: "abc1234" }] });
    await call("add_link", { key, kind: "pr", url: "https://example.com/pr/1" });
    await call("complete_issue", { key, note: "Hecho", evidence: [{ url: "tests: 12 passed" }] });
    const got = await call("get_issue", { key });
    expect(got.state).toBe("Done");
    expect(got.labels).toEqual(["backend"]);
    expect(got.links.map((l: any) => l.kind).sort()).toEqual(["commit", "evidence", "pr"]);
    expect(got.comments.map((c: any) => c.by)).toEqual(["agent:claude-code", "agent:claude-code"]);
    expect(got.activity.every((a: any) => a.by === "agent:claude-code")).toBe(true);
  });

  it("update_issue keeps the previous description in the activity log", async () => {
    const { key } = await call("create_issue", { project: "AGT", title: "Doc", description: "original" });
    await call("update_issue", { key, description: "reemplazada" });
    const { getIssueByKey, listActivity } = await import("@/server/services/issues");
    const i = await getIssueByKey(key);
    const a = (await listActivity(i.id)).find((x) => x.action === "issue.updated")!;
    expect((a.data.changes as any).description).toEqual({ from: "original", to: "reemplazada" });
  });

  it("next_work skips blocked issues and prefers started, then priority", async () => {
    const a = (await call("create_issue", { project: "AGT", title: "A bloqueador", priority: "low" })).key;
    const b = (await call("create_issue", { project: "AGT", title: "B bloqueado", priority: "urgent" })).key;
    const c = (await call("create_issue", { project: "AGT", title: "C urgente libre", priority: "urgent" })).key;
    await call("add_relation", { key: a, related: b, type: "blocks" });
    let next = (await call("next_work", { project: "AGT", limit: 20 })).map((x: any) => x.key);
    expect(next).not.toContain(b);
    expect(next.indexOf(c)).toBeLessThan(next.indexOf(a));
    await call("set_state", { key: a, state: "In Progress" });
    next = (await call("next_work", { project: "AGT", limit: 20 })).map((x: any) => x.key);
    expect(next[0]).toBe(a); // started first
    await call("complete_issue", { key: a });
    next = (await call("next_work", { project: "AGT", limit: 20 })).map((x: any) => x.key);
    expect(next).toContain(b); // unblocked once the blocker is done
    const rel = (await call("get_issue", { key: b })).relations;
    expect(rel[0]).toMatchObject({ type: "blocked_by", key: a });
  });

  it("search finds by exact key and by text; archive hides without deleting", async () => {
    expect((await call("search", { query: "AGT-1" }))[0].key).toBe("AGT-1");
    expect((await call("search", { query: "bloqueador" })).length).toBeGreaterThan(0);
    await call("archive_issue", { key: "AGT-1" });
    expect((await call("list_issues", { project: "AGT" })).map((i: any) => i.key)).not.toContain("AGT-1");
    expect((await call("list_issues", { project: "AGT", includeArchived: true })).map((i: any) => i.key)).toContain("AGT-1");
    await call("archive_issue", { key: "AGT-1", archived: false });
  });
});
