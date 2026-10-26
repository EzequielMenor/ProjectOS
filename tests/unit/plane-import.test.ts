import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { activity } from "@/db/schema";
import { htmlToMarkdown } from "@/server/import/html";
import { importPlaneSnapshot, parseSnapshot, planPlaneProject, SNAPSHOT_FORMAT, SNAPSHOT_VERSION, type PlaneSnapshot } from "@/server/import/plane";
import { fetchPlaneSnapshot, PlaneClient } from "@/server/import/plane-fetch";
import { createIssue, getIssueByKey, listIssues } from "@/server/services/issues";
import { listProjects } from "@/server/services/projects";
import { listCycles, listModules } from "@/server/services/planning";
import { createBackup, restoreBackup } from "@/server/services/backup";

process.env.BACKUP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "projectos-imp-"));

// Synthetic fixture that follows Plane's v1 payload shape (ids are uuids, parent/state are ids,
// descriptions are HTML). It exercises the converter; it is not a substitute for a real import.
const S = { backlog: "s-backlog", todo: "s-todo", review: "s-review", blocked: "s-blocked", done: "s-done" };
const fixture = (): PlaneSnapshot => ({
  format: SNAPSHOT_FORMAT,
  version: SNAPSHOT_VERSION,
  fetchedAt: "2026-10-26T10:00:00.000Z",
  workspace: "acme",
  projects: [
    {
      project: { id: "p1", identifier: "fich", name: "Fichaje", description: "Control horario" },
      states: [
        { id: S.backlog, name: "Backlog", group: "backlog", color: "#60646C", sequence: 15000 },
        { id: S.todo, name: "Todo", group: "unstarted", color: "#60646C", sequence: 25000, default: true },
        { id: S.review, name: "Review", group: "started", color: "#F59E0B", sequence: 35000 },
        { id: S.blocked, name: "Blocked", group: "started", color: "#EF4444", sequence: 45000 },
        { id: S.done, name: "Done", group: "completed", color: "#46A758", sequence: 55000 },
      ],
      labels: [{ id: "l1", name: "backend", color: "#3b82f6" }],
      issues: [
        { id: "i1", sequence_id: 1, name: "Terminal de fichaje", description_html: "<p>Kiosco <strong>web</strong></p><ul><li>RFID</li></ul>", state: S.review, priority: "high", parent: null, labels: ["l1"], target_date: "2026-11-30", created_at: "2026-09-01T10:00:00Z", updated_at: "2026-09-02T10:00:00Z", assignees: ["u1"] },
        { id: "i2", sequence_id: 7, name: "Lector RFID", description_html: "<p></p>", state: S.blocked, priority: "urgent", parent: "i1", labels: [], created_at: "2026-09-03T10:00:00Z", updated_at: "2026-09-03T10:00:00Z" },
        { id: "i3", sequence_id: 9, name: "Informe PDF", description_html: "<p>Listo</p>", state: S.done, priority: "none", parent: {}, labels: [], created_at: "2026-09-04T10:00:00Z", updated_at: "2026-09-05T10:00:00Z", completed_at: "2026-09-05T10:00:00Z" },
      ],
      cycles: [{ cycle: { id: "c1", name: "Sprint 1", start_date: "2026-10-01", end_date: "2026-10-14" }, issueIds: ["i1", "i2"] }],
      modules: [{ module: { id: "m1", name: "A · Base", status: "in-progress", target_date: "2026-11-01" }, issueIds: ["i1", "i3", "ghost"] }],
      comments: { i1: [{ id: "k1", comment_html: "<p>Empezado</p>", created_at: "2026-09-02T09:00:00Z" }] },
      links: { i1: [{ id: "n1", url: "https://example.com/spec", title: "Spec", created_at: "2026-09-02T09:30:00Z" }] },
      relations: { i2: { blocking: ["i3"], blocked_by: ["i1"], duplicate: [], relates_to: [] }, i3: { blocked_by: ["i2"] } },
      pages: [{ id: "pg1", name: "Notas" }],
      expectedIssueCount: 3,
    },
  ],
});

describe("htmlToMarkdown", () => {
  it("converts rich text and drops empty paragraphs", () => {
    expect(htmlToMarkdown("<p>Kiosco <strong>web</strong></p><ul><li>RFID</li></ul>")).toBe("Kiosco **web**\n\n- RFID");
    expect(htmlToMarkdown("<p></p>")).toBe("");
    expect(htmlToMarkdown("texto plano")).toBe("texto plano");
  });
});

describe("planPlaneProject", () => {
  it("maps ids, parents, relations and warns about what it cannot import", () => {
    const plan = planPlaneProject(fixture().projects[0]);
    expect(plan.errors).toEqual([]);
    expect(plan.identifier).toBe("FICH");
    expect(plan.issueCounter).toBe(9);
    expect(plan.issues.find((i) => i.key === "i2")!.parentKey).toBe("i1");
    expect(plan.issues.find((i) => i.key === "i3")!.parentKey).toBeNull();
    expect(plan.modules[0].issueKeys).toEqual(["i1", "i3"]);
    // blocking/blocked_by describe the same edges from both sides: deduplicated
    expect(plan.relations.filter((r) => r.type === "blocks")).toHaveLength(2);
    expect(plan.warnings.join(" ")).toMatch(/1 páginas no se importan/);
    expect(plan.skipped.assignees).toBe(1);
  });

  it("reports validation errors instead of guessing", () => {
    const f = fixture().projects[0];
    f.issues.push({ id: "dup", sequence_id: 7, name: "dup", state: S.todo });
    f.issues.push({ id: "bad", sequence_id: 12, name: "bad", state: "nope" });
    const plan = planPlaneProject(f);
    expect(plan.errors.join("\n")).toMatch(/sequence_id duplicado: 7/);
    expect(plan.errors.join("\n")).toMatch(/estado desconocido/);
    expect(plan.errors.join("\n")).toMatch(/declara 3 work items pero el snapshot tiene 3|declara 3/);
  });

  it("rejects snapshots from other tools", () => {
    expect(() => parseSnapshot({ format: "other" })).toThrow();
  });
});

describe("importPlaneSnapshot", () => {
  it("dry run writes nothing, real run preserves keys and custom states, rerun is skipped", async () => {
    const snap = fixture();
    const dry = await importPlaneSnapshot(snap, { dryRun: true, expected: { FICH: 3 } });
    expect(dry[0].status).toBe("planned");
    expect((await listProjects()).map((x) => x.identifier)).not.toContain("FICH");

    const wrong = await importPlaneSnapshot(snap, { dryRun: true, expected: { FICH: 31 } });
    expect(wrong[0].status).toBe("invalid");

    const real = await importPlaneSnapshot(snap, { expected: { FICH: 3 } });
    expect(real[0].status).toBe("imported");

    const i2 = await getIssueByKey("FICH-7");
    expect(i2.title).toBe("Lector RFID");
    expect(i2.parentId).toBe((await getIssueByKey("FICH-1")).id);
    expect(i2.createdBy).toBe("plane-import");
    const i1 = await getIssueByKey("FICH-1");
    expect(i1.description).toBe("Kiosco **web**\n\n- RFID");
    expect(i1.comments.map((c) => c.body)).toEqual(["Empezado"]);
    expect(i1.links[0].url).toBe("https://example.com/spec");
    expect(i1.createdAt.toISOString()).toBe("2026-09-01T10:00:00.000Z");
    expect(i1.modules).toHaveLength(1);
    expect(i1.cycleId).toBeTruthy();
    const all = await listIssues({ project: "FICH" });
    const names = new Set((all as { state: { name: string } }[]).map((i) => i.state.name));
    expect(names).toEqual(new Set(["Review", "Blocked", "Done"]));
    expect((await listCycles((await getIssueByKey("FICH-1")).projectId))[0].name).toBe("Sprint 1");
    expect((await listModules(i1.projectId))[0].status).toBe("in_progress");

    // new issues continue after the highest imported number
    expect((await createIssue({ projectId: i1.projectId, title: "nuevo" })).seq).toBe(10);

    const again = await importPlaneSnapshot(snap, {});
    expect(again[0].status).toBe("skipped");
    const acts = await (await getDb()).select().from(activity);
    expect(acts.filter((a) => a.action === "project.imported")).toHaveLength(1);
  });

  it("survives a backup/restore round trip", async () => {
    const before = await createBackup();
    await restoreBackup(before, { replace: true });
    const after = await createBackup();
    expect(after.counts).toEqual(before.counts);
  });
});

describe("Plane REST client", () => {
  it("paginates, throttles, retries on 429, sends the key and only GETs", async () => {
    const calls: { url: string; method: string; key: string | null }[] = [];
    let limited = false;
    const json = (b: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(b), { status, headers });
    const fetchImpl = (async (input: URL | string, init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push({ url: url.pathname + url.search, method: init?.method ?? "GET", key: new Headers(init?.headers).get("x-api-key") });
      const p = url.pathname;
      if (p.endsWith("/projects/")) return json({ results: [{ id: "p1", identifier: "FICH", name: "Fichaje" }, { id: "p2", identifier: "OTH", name: "Otro" }], next_page_results: false });
      if (p.endsWith("/states/")) return json({ results: [{ id: "s", name: "Todo", group: "unstarted", color: "#111111" }] });
      if (p.endsWith("/labels/")) return json([]);
      if (p.endsWith("/work-items/")) {
        if (!limited) { limited = true; return json({ detail: "slow down" }, 429, { "retry-after": "0" }); }
        return url.searchParams.get("cursor")
          ? json({ results: [{ id: "b", sequence_id: 2, name: "B", state: "s" }], next_page_results: false, total_results: 2 })
          : json({ results: [{ id: "a", sequence_id: 1, name: "A", state: "s" }], next_page_results: true, next_cursor: "100:1:0", total_results: 2 });
      }
      if (p.endsWith("/cycles/")) return json({ detail: "not found" }, 404);
      if (p.endsWith("/modules/")) return json({ results: [{ id: "m", name: "M" }] });
      if (p.endsWith("/module-issues/")) return json({ results: [{ issue: "a" }] });
      if (p.endsWith("/comments/")) return json({ results: [] });
      if (p.endsWith("/links/")) return json({ results: [] });
      if (p.endsWith("/relations/")) return json({ blocking: ["a"] });
      return json({ detail: "nope" }, 404);
    }) as typeof fetch;

    const snap = await fetchPlaneSnapshot({ apiKey: "plane_api_x", workspace: "acme", only: ["fich"], minIntervalMs: 0, fetchImpl });
    expect(snap.projects).toHaveLength(1);
    const p = snap.projects[0];
    expect(p.issues.map((i) => i.id)).toEqual(["a", "b"]);
    expect(p.expectedIssueCount).toBe(2);
    expect(p.modules[0].issueIds).toEqual(["a"]);
    expect(p.cycles).toEqual([]);
    expect(Object.keys(p.relations)).toEqual(["a", "b"]);
    expect(calls.every((c) => c.method === "GET" && c.key === "plane_api_x")).toBe(true);
    expect(JSON.stringify(snap)).not.toContain("plane_api_x");
    // the snapshot feeds straight into the importer's validation
    expect(planPlaneProject(p).errors).toEqual([]);
  });

  it("surfaces non-retryable errors", async () => {
    const c = new PlaneClient({ apiKey: "k", workspace: "w", minIntervalMs: 0, fetchImpl: (async () => new Response("{}", { status: 401, statusText: "Unauthorized" })) as typeof fetch });
    await expect(c.list("/api/v1/workspaces/w/projects/")).rejects.toThrow(/401/);
  });
});
