import { afterEach, describe, expect, it } from "vitest";
import { getDb, isDemoMode } from "@/db/client";
import { resetDemoData, seedDemoData } from "@/server/services/demo";
import { createIssue, getIssueByKey, listIssues } from "@/server/services/issues";
import { listPages, pageLinks } from "@/server/services/pages";
import { listProjects } from "@/server/services/projects";

describe("demo mode & seed", () => {
  const origDemo = process.env.DEMO_MODE;
  const origVercel = process.env.VERCEL;
  const origDbUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (origDemo === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = origDemo;
    if (origVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = origVercel;
    if (origDbUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = origDbUrl;
  });

  it("detects DEMO_MODE and Vercel environment without DATABASE_URL", () => {
    delete process.env.DEMO_MODE;
    delete process.env.VERCEL;
    process.env.DATABASE_URL = "";
    expect(isDemoMode()).toBe(false);

    process.env.DEMO_MODE = "1";
    expect(isDemoMode()).toBe(true);

    process.env.DEMO_MODE = "0";
    process.env.VERCEL = "1";
    expect(isDemoMode()).toBe(false); // explicit DEMO_MODE=0 overrides VERCEL=1

    delete process.env.DEMO_MODE;
    process.env.VERCEL = "1";
    process.env.DATABASE_URL = "";
    expect(isDemoMode()).toBe(true);
  });

  it("seeds realistic projects, Kanban issues, agent evidence, and docs, and resets cleanly", async () => {
    const db = await getDb();
    const res = await seedDemoData(db, { force: true });
    expect(res.seeded).toBe(true);

    // Calling without force when data already exists does not duplicate projects
    const second = await seedDemoData(db, { force: false });
    expect(second.seeded).toBe(false);

    const projects = await listProjects();
    expect(projects.map((p) => p.identifier)).toEqual(["POS", "WEB"]);

    const pos = projects[0]!;
    const issues = await listIssues({ projectId: pos.id });
    expect(issues.length).toBe(10);

    const mcpIssue = await getIssueByKey("POS-2");
    expect(mcpIssue.links.length).toBeGreaterThanOrEqual(2);
    expect(mcpIssue.comments.length).toBeGreaterThanOrEqual(2);

    const pages = await listPages(pos.id);
    expect(pages.length).toBe(2);
    const guideLinks = await pageLinks(pages[0]!.id);
    expect(guideLinks.issues.length).toBeGreaterThan(0);

    // Mutate data as a visitor would, then reset via resetDemoData()
    await createIssue({ projectId: pos.id, title: "Issue temporal de prueba del visitante" });
    expect((await listIssues({ projectId: pos.id })).length).toBe(11);

    await expect(resetDemoData()).rejects.toMatchObject({ code: "forbidden" });
    process.env.DEMO_MODE = "1";
    await resetDemoData();
    expect((await listIssues({ projectId: pos.id })).length).toBe(10);
  });
});
