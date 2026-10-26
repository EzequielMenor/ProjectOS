import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createBackup, parseBackup, restoreBackup } from "@/server/services/backup";
import { addComment, addLink, addRelation, createIssue, getIssueByKey, listIssues } from "@/server/services/issues";
import { ensureLabel } from "@/server/services/labels";
import { createProject, listProjects, listStates } from "@/server/services/projects";
import { createToken, authenticate } from "@/server/services/tokens";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "projectos-bk-"));
process.env.BACKUP_DIR = dir;

let token: string;

beforeAll(async () => {
  const p = await createProject({ identifier: "BKP", name: "Backup" });
  const states = await listStates(p.id);
  const epic = await createIssue({ projectId: p.id, title: "Epic", type: "epic", description: "con **markdown** y ñ/ü/日本" });
  const child = await createIssue({ projectId: p.id, title: "Hija", parentId: epic.id, stateId: states[2].id, dueDate: "2026-12-31" });
  const other = await createIssue({ projectId: p.id, title: "Otra", estimate: 5 });
  const l = await ensureLabel({ projectId: p.id, name: "bug", color: "#ff0000" });
  await (await import("@/server/services/issues")).updateIssue(child.id, { labelIds: [l.id] });
  await addRelation(child.id, { relatedIssueId: other.id, type: "blocks" });
  await addComment(child.id, { body: "comentario" });
  await addLink(child.id, { kind: "commit", url: "abc123" });
  token = (await createToken({ name: "keep-me", scope: "write" })).token;
});

describe("backup / restore", () => {
  it("round-trips everything, including hierarchy, dates, relations and unicode", async () => {
    const before = await createBackup();
    expect(before.counts.issue).toBe(3);
    // mutate after the backup: add a project and edit an issue
    await createProject({ identifier: "LATE", name: "Después" });
    const hija = await getIssueByKey("BKP-2");
    await (await import("@/server/services/issues")).updateIssue(hija.id, { title: "CAMBIADA" });

    const res = await restoreBackup(before, { replace: true });
    expect(res.preRestoreBackup && fs.existsSync(res.preRestoreBackup)).toBe(true);

    const after = await createBackup();
    expect(after.counts).toEqual(before.counts);
    const strip = (b: typeof before) => ({ ...b.tables }); // ignores createdAt of the backup itself
    expect(strip(after)).toEqual(strip(before));
    expect((await listProjects()).map((p) => p.identifier)).toEqual(["BKP"]);
    const restored = await getIssueByKey("BKP-2");
    expect(restored.title).toBe("Hija");
    expect(restored.parent?.seq).toBe(1);
    expect((await getIssueByKey("BKP-1")).description).toContain("日本");
    expect((await listIssues({ projectId: restored.projectId })).length).toBe(3);
  });

  it("keeps API tokens working after a restore (they are not part of the backup file)", async () => {
    const b = await createBackup();
    expect(JSON.stringify(b)).not.toContain("token_hash");
    await restoreBackup(b, { replace: true });
    expect((await authenticate(`Bearer ${token}`)).name).toBe("keep-me");
  });

  it("dry-run changes nothing; refuses to overwrite without replace", async () => {
    const b = await createBackup();
    await createProject({ identifier: "TMP", name: "temporal" });
    const dry = await restoreBackup(b, { dryRun: true, replace: true });
    expect(dry).toMatchObject({ dryRun: true, counts: b.counts });
    expect((await listProjects()).map((p) => p.identifier).sort()).toEqual(["BKP", "TMP"]);
    await expect(restoreBackup(b)).rejects.toThrow(/ya tiene proyectos/);
  });

  it("rejects corrupt or incomplete backups before touching data", async () => {
    const b = await createBackup();
    expect(() => parseBackup({ nope: 1 })).toThrow(/no válido/);
    expect(() => parseBackup({ ...b, tables: { ...b.tables, issue: b.tables.issue.slice(1) } })).toThrow(/incompleta/);
    expect(() => parseBackup({ ...b, version: 99 })).toThrow(/más nueva/);
    const before = (await listProjects()).length;
    await expect(restoreBackup({ ...b, tables: { ...b.tables, issue: [] } }, { replace: true })).rejects.toThrow();
    expect((await listProjects()).length).toBe(before);
  });
});
