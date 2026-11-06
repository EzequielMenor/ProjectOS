import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, describe, expect, it } from "vitest";
import { PROJECT_STATUSES } from "@/db/schema";
import { createBackup, restoreBackup, type Backup } from "@/server/services/backup";
import { createIssue, listIssues, updateIssue } from "@/server/services/issues";
import { createProject, listProjects, listStates, setProjectArchived, updateProject } from "@/server/services/projects";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "projectos-lifecycle-"));
process.env.BACKUP_DIR = scratch;
afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));

const DRIZZLE_DIR = path.join(process.cwd(), "drizzle");

/** Public export of everything stored; two equal snapshots mean no data, counter or activity changed. */
async function stored() {
  const backup = await createBackup();
  return { counts: backup.counts, tables: backup.tables };
}

async function statusOf(identifier: string) {
  return (await listProjects({ includeArchived: true })).find((p) => p.identifier === identifier)?.status;
}

describe("project lifecycle migration", () => {
  it("keeps existing projects, counters and tickets intact and unclassified", async () => {
    // A database as it was before 0006: only the first migrations (0000-0005) applied.
    const old = path.join(scratch, "pre-0006");
    fs.mkdirSync(path.join(old, "meta"), { recursive: true });
    const journal = JSON.parse(fs.readFileSync(path.join(DRIZZLE_DIR, "meta", "_journal.json"), "utf8"));
    journal.entries = journal.entries.filter((e: { idx: number }) => e.idx <= 5);
    fs.writeFileSync(path.join(old, "meta", "_journal.json"), JSON.stringify(journal));
    for (const e of journal.entries) fs.copyFileSync(path.join(DRIZZLE_DIR, `${e.tag}.sql`), path.join(old, `${e.tag}.sql`));

    const client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: old });
    await client.exec(`
      INSERT INTO workspace (id, slug, name) VALUES ('00000000-0000-4000-8000-000000000001', 'default', 'Mi workspace');
      INSERT INTO project (id, workspace_id, identifier, name, description, issue_counter, archived_at)
        VALUES ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'OLD', 'Antiguo', 'desc', 1, now());
      INSERT INTO state (id, project_id, name, "group", color, is_default)
        VALUES ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'Todo', 'unstarted', '#64748b', 1);
      INSERT INTO issue (project_id, seq, title, state_id)
        VALUES ('00000000-0000-4000-8000-000000000002', 1, 'Ticket previo', '00000000-0000-4000-8000-000000000003');
    `);

    await migrate(db, { migrationsFolder: DRIZZLE_DIR });

    const { rows } = await client.query<{ identifier: string; name: string; description: string; issue_counter: number; archived: boolean; status: string | null }>(
      `SELECT identifier, name, description, issue_counter, archived_at IS NOT NULL AS archived, status FROM project`,
    );
    expect(rows).toEqual([{ identifier: "OLD", name: "Antiguo", description: "desc", issue_counter: 1, archived: true, status: null }]);
    const issues = await client.query<{ title: string; seq: number }>(`SELECT title, seq FROM issue`);
    expect(issues.rows).toEqual([{ title: "Ticket previo", seq: 1 }]);

    // The database itself refuses anything outside the lifecycle vocabulary (e.g. from a hand-edited backup).
    await expect(client.exec(`UPDATE project SET status = 'bogus'`)).rejects.toThrow();
    await client.exec(`UPDATE project SET status = 'active'`);
    await client.close();
  });
});

describe("project lifecycle service", () => {
  it("starts new projects planned and ignores a status passed on creation", async () => {
    const p = await createProject({ identifier: "NEWP", name: "Nuevo", description: "d", color: "#112233" });
    expect(p).toMatchObject({ identifier: "NEWP", name: "Nuevo", description: "d", color: "#112233", status: "planned", archivedAt: null });
    const q = await createProject({ identifier: "NEWQ", name: "Otro", status: "completed" });
    expect(q.status).toBe("planned");
  });

  it("accepts every lifecycle state and lets the human clear it back to unclassified", async () => {
    const p = await createProject({ identifier: "CYCL", name: "Ciclo" });
    expect([...PROJECT_STATUSES]).toEqual(["planned", "active", "paused", "completed", "cancelled"]);
    for (const status of PROJECT_STATUSES) {
      expect((await updateProject(p.id, { status })).status).toBe(status);
      expect(await statusOf("CYCL")).toBe(status);
    }
    expect((await updateProject(p.id, { status: null })).status).toBeNull();
    expect(await statusOf("CYCL")).toBeNull();
  });

  it("keeps the status when only metadata is edited", async () => {
    const p = await createProject({ identifier: "META", name: "Meta" });
    await updateProject(p.id, { status: "paused" });
    const edited = await updateProject(p.id, { name: "Renombrado", description: "nueva", color: "#abcdef" });
    expect(edited).toMatchObject({ name: "Renombrado", description: "nueva", color: "#abcdef", status: "paused" });
  });

  it("rejects an unknown status without changing data, counters or activity", async () => {
    const p = await createProject({ identifier: "BADS", name: "Mala" });
    await createIssue({ projectId: p.id, title: "Ticket" });
    await updateProject(p.id, { status: "active" });
    const before = await stored();
    for (const status of ["bogus", "", "Active", 3]) {
      await expect(updateProject(p.id, { name: "No debe cambiar", status })).rejects.toThrow();
    }
    expect(await stored()).toEqual(before);
  });

  it("keeps archive and lifecycle independent", async () => {
    const p = await createProject({ identifier: "ARCH", name: "Archivo" });
    await updateProject(p.id, { status: "completed" });
    const archived = await setProjectArchived(p.id, true);
    expect(archived).toMatchObject({ status: "completed" });
    expect(archived.archivedAt).toBeInstanceOf(Date);

    const changed = await updateProject(p.id, { status: "active" });
    expect(changed.status).toBe("active");
    expect(changed.archivedAt).toEqual(archived.archivedAt);

    const restored = await setProjectArchived(p.id, false);
    expect(restored).toMatchObject({ status: "active", archivedAt: null });
  });

  it("does not touch tickets or complete anything automatically when the status changes", async () => {
    const p = await createProject({ identifier: "TICK", name: "Tickets" });
    const states = await listStates(p.id);
    const open = await createIssue({ projectId: p.id, title: "Abierto" });
    const done = await createIssue({ projectId: p.id, title: "Hecho" });
    await updateIssue(done.id, { stateId: states.find((s) => s.group === "completed")!.id });
    const tables = async () => {
      const t = (await createBackup()).tables;
      return { issue: t.issue, state: t.state, issue_module: t.issue_module };
    };
    const counter = async () => (await listProjects()).find((x) => x.identifier === "TICK")!.issueCounter;
    const before = { tables: await tables(), issues: await listIssues({ projectId: p.id }), counter: await counter() };

    for (const status of ["active", "completed", "cancelled", "paused", null]) await updateProject(p.id, { status });

    expect({ tables: await tables(), issues: await listIssues({ projectId: p.id }), counter: await counter() }).toEqual(before);
    expect(open.id).toBeDefined();
  });
});

describe("project lifecycle backups", () => {
  const withoutStatus = (b: Backup): Backup => {
    const copy = structuredClone(b);
    for (const row of copy.tables.project) delete row.status;
    return copy;
  };

  it("restores a backup written before the status field existed as unclassified", async () => {
    const current = await createBackup();
    expect(current.tables.project.length).toBeGreaterThan(0);
    await restoreBackup(withoutStatus(current), { replace: true });
    const projects = await listProjects({ includeArchived: true });
    expect(projects.length).toBe(current.tables.project.length);
    expect(projects.every((p) => p.status === null)).toBe(true);
    expect(current.version).toBe(1);
  });

  it("round-trips lifecycle states, including unclassified, through a new backup", async () => {
    const [a, b] = await listProjects({ includeArchived: true });
    await updateProject(a.id, { status: "paused" });
    await updateProject(b.id, { status: null });
    const before = await createBackup();
    const statuses = Object.fromEntries(before.tables.project.map((r) => [r.identifier as string, r.status]));
    expect(statuses[a.identifier]).toBe("paused");
    expect(statuses[b.identifier]).toBeNull();

    await updateProject(a.id, { status: "cancelled" });
    await restoreBackup(before, { replace: true });
    expect((await createBackup()).tables).toEqual(before.tables);
  });

  it("refuses a backup with an unknown status and leaves the current data untouched", async () => {
    const good = await createBackup();
    const bad = structuredClone(good);
    bad.tables.project[0].status = "bogus";
    const before = await stored();
    await expect(restoreBackup(bad, { replace: true })).rejects.toThrow();
    expect(await stored()).toEqual(before);
  });
});
