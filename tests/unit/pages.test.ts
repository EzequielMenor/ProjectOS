import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { callTool } from "@/server/agent/tools";
import { createBackup, restoreBackup } from "@/server/services/backup";
import { createIssue } from "@/server/services/issues";
import {
  appendToPage,
  createPage,
  extractRefs,
  getPage,
  linkify,
  listPages,
  listPageVersions,
  pageLinks,
  pagesMentioningIssue,
  resolveContent,
  restorePageVersion,
  searchPages,
  setPageArchived,
  updatePage,
} from "@/server/services/pages";
import { createProject } from "@/server/services/projects";
import { authenticate, createToken } from "@/server/services/tokens";

process.env.BACKUP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "projectos-pages-"));
let projectId: string;
let issueA: { id: string; seq: number };

beforeAll(async () => {
  projectId = (await createProject({ identifier: "DOC", name: "Docs" })).id;
  issueA = await createIssue({ projectId, title: "Terminal" });
});

describe("references", () => {
  it("finds keys and page titles but ignores code", () => {
    const refs = extractRefs("Ver DOC-1 y [[DOC-2]] y [[Arquitectura]]\n\n`DOC-9` y\n```\nDOC-8 [[Nada]]\n```");
    expect(refs.keys.sort()).toEqual(["DOC-1", "DOC-2"]);
    expect(refs.titles).toEqual(["Arquitectura"]);
  });
});

describe("pages", () => {
  it("links to issues and pages in both directions, including pages created later", async () => {
    const a = await createPage({ projectId, title: "Diseño", content: `Depende de DOC-${issueA.seq} y de [[Arquitectura]]` });
    expect((await pagesMentioningIssue(issueA.id)).map((p) => p.title)).toEqual(["Diseño"]);
    expect((await pageLinks(a.id)).outgoing).toEqual([]); // target does not exist yet
    const arch = await createPage({ projectId, title: "Arquitectura", content: "Todo en un monolito." });
    expect((await pageLinks(a.id)).outgoing.map((p) => p.title)).toEqual(["Arquitectura"]);
    expect((await pageLinks(arch.id)).backlinks.map((p) => p.title)).toEqual(["Diseño"]);

    const md = linkify(a.content, await resolveContent(projectId, a.content));
    expect(md).toContain(`[DOC-${issueA.seq}](/DOC/issues/${issueA.seq} "Terminal")`);
    expect(md).toContain(`[Arquitectura](/DOC/pages/${arch.id})`);
    expect(linkify("[[Falta]] y `DOC-1`", await resolveContent(projectId, "[[Falta]]"))).toBe("[Falta](# \"Página sin crear\") y `DOC-1`");
  });

  it("rejects duplicate titles case-insensitively", async () => {
    await expect(createPage({ projectId, title: "arquitectura" })).rejects.toMatchObject({ code: "conflict" });
  });

  it("keeps every previous version, detects stale edits, appends and restores", async () => {
    const p = await createPage({ projectId, title: "Notas", content: "uno" });
    const u1 = await updatePage(p.id, { content: "dos", expectedUpdatedAt: p.updatedAt.toISOString() }, "agent:x");
    await expect(updatePage(p.id, { content: "tres", expectedUpdatedAt: p.updatedAt.toISOString() })).rejects.toMatchObject({ code: "conflict" });
    await appendToPage(p.id, "añadido", "agent:x");
    expect((await getPage(p.id)).content).toBe("dos\n\nañadido");
    const versions = await listPageVersions(p.id);
    expect(versions.map((v) => v.content)).toEqual(["dos", "uno"]);
    expect(versions[0].actor).toBe("agent:x");
    await restorePageVersion(p.id, versions[1].id);
    expect((await getPage(p.id)).content).toBe("uno");
    expect((await listPageVersions(p.id)).map((v) => v.content)).toEqual(["dos\n\nañadido", "dos", "uno"]);
    expect(u1.updatedAt.getTime()).toBeGreaterThanOrEqual(p.updatedAt.getTime());
  });

  it("archives reversibly and searches literally", async () => {
    const p = await createPage({ projectId, title: "Tarifas 100%", content: "precio" });
    expect((await searchPages("100%")).map((x) => x.title)).toEqual(["Tarifas 100%"]);
    expect(await searchPages("%")).toHaveLength(1);
    await setPageArchived(p.id, true);
    expect(await searchPages("100%")).toEqual([]);
    expect((await listPages(projectId)).map((x) => x.title)).not.toContain("Tarifas 100%");
    expect((await listPages(projectId, { includeArchived: true })).map((x) => x.title)).toContain("Tarifas 100%");
    await setPageArchived(p.id, false);
  });

  it("survives backup and restore with links and history", async () => {
    const before = await createBackup();
    expect(before.counts.page).toBeGreaterThanOrEqual(3);
    expect(before.counts.page_version).toBeGreaterThanOrEqual(3);
    await restoreBackup(before, { replace: true });
    const after = await createBackup();
    expect(after.counts).toEqual(before.counts);
    expect(after.tables.page_issue_link).toEqual(before.tables.page_issue_link);
  });
});

describe("agent tools for pages", () => {
  it("require write scope, force read-before-write and never delete", async () => {
    const ro = await authenticate(`Bearer ${(await createToken({ name: "ro", scope: "read" })).token}`);
    const rw = await authenticate(`Bearer ${(await createToken({ name: "rw", scope: "write" })).token}`);
    const call = (n: string, a: unknown, c = rw) => callTool(n, a, c) as Promise<any>;
    await expect(call("create_page", { project: "DOC", title: "X" }, ro)).rejects.toMatchObject({ code: "forbidden" });
    const created = await call("create_page", { project: "DOC", title: "Decisiones", content: "Usamos Postgres (DOC-1)" });
    const got = await call("get_page", { project: "DOC", page: "decisiones" }, ro);
    expect(got.content).toBe("Usamos Postgres (DOC-1)");
    expect(got.mentionsIssues).toEqual(["DOC-1"]);
    await call("append_to_page", { project: "DOC", page: created.id, text: "- ADR 2" });
    await expect(call("update_page", { project: "DOC", page: created.id, expectedUpdatedAt: got.updatedAt, content: "pisado" })).rejects.toMatchObject({ code: "conflict" });
    const fresh = await call("get_page", { project: "DOC", page: created.id }, ro);
    await call("update_page", { project: "DOC", page: created.id, expectedUpdatedAt: fresh.updatedAt, content: "reescrito" });
    const versions = await call("list_page_versions", { project: "DOC", page: created.id }, ro);
    expect(versions.map((v: { by: string }) => v.by)).toEqual(["agent:rw", "agent:rw"]);
    await call("restore_page_version", { project: "DOC", page: created.id, versionId: versions[1].id });
    expect((await call("get_page", { project: "DOC", page: created.id }, ro)).content).toBe("Usamos Postgres (DOC-1)");
    expect((await call("search_pages", { query: "Postgres" }, ro)).map((p: { title: string }) => p.title)).toContain("Decisiones");
    const { describeTools } = await import("@/server/agent/tools");
    expect(describeTools().some((t) => /delete|remove/i.test(t.name))).toBe(false);
  });
});
