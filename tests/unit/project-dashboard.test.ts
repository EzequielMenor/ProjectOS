import { describe, expect, it } from "vitest";
import { createBackup } from "@/server/services/backup";
import { addRelation, createIssue, listActivity, setIssueArchived, updateIssue } from "@/server/services/issues";
import { createProject, listStates, setProjectArchived, updateProject } from "@/server/services/projects";
import { listProjectDashboard } from "@/server/services/project-dashboard";

async function fixture(identifier: string) {
  const project = await createProject({ identifier, name: `Dashboard ${identifier}` });
  const states = await listStates(project.id);
  const state = (group: string) => states.find((s) => s.group === group)!.id;
  return { project, state };
}

const row = async (id: string) => (await listProjectDashboard()).find((p) => p.id === id)!;

describe("project dashboard", () => {
  it("counts real tasks without archived, cancelled or epic rows, independently of project lifecycle", async () => {
    const { project, state } = await fixture("DPROG");
    const epic = await createIssue({ projectId: project.id, title: "Épica", type: "epic" });
    await createIssue({ projectId: project.id, title: "Hija", parentId: epic.id });
    await createIssue({ projectId: project.id, title: "Pendiente" });
    const done = await createIssue({ projectId: project.id, title: "Terminada", stateId: state("completed") });
    await createIssue({ projectId: project.id, title: "Cancelada", stateId: state("cancelled") });
    const archived = await createIssue({ projectId: project.id, title: "Archivada", stateId: state("completed") });
    await setIssueArchived(archived.id, true);
    expect(await row(project.id)).toMatchObject({ total: 3, completed: 1, started: 0, percent: 33, archived: false, status: "planned" });
    await updateProject(project.id, { status: "completed" });
    await setProjectArchived(project.id, true);
    expect(await row(project.id)).toMatchObject({ total: 3, completed: 1, percent: 33, archived: true, status: "completed" });
    await updateIssue(done.id, { stateId: state("unstarted") });
    expect(await row(project.id)).toMatchObject({ completed: 0, percent: 0, status: "completed" });
  });

  it("suggests unblocked work: started first, then priority and board order; updates when work completes", async () => {
    const { project, state } = await fixture("DNEXT");
    const blocker = await createIssue({ projectId: project.id, title: "Bloqueador", stateId: state("backlog") });
    const blocked = await createIssue({ projectId: project.id, title: "Bloqueada urgente", priority: "urgent" });
    await addRelation(blocker.id, { type: "blocks", relatedIssueId: blocked.id });
    const urgent = await createIssue({ projectId: project.id, title: "Urgente libre", priority: "urgent" });
    const started = await createIssue({ projectId: project.id, title: "Ya iniciada", stateId: state("started"), priority: "low" });
    await createIssue({ projectId: project.id, title: "Épica urgente", type: "epic", priority: "urgent", stateId: state("started") });
    const archived = await createIssue({ projectId: project.id, title: "Archivada urgente", priority: "urgent", stateId: state("started") });
    await setIssueArchived(archived.id, true);
    expect(await row(project.id)).toMatchObject({ started: 1, nextIssue: { seq: started.seq, title: started.title } });
    await updateIssue(started.id, { stateId: state("completed") });
    expect(await row(project.id)).toMatchObject({ nextIssue: { seq: urgent.seq, title: urgent.title } });
    await updateIssue(urgent.id, { stateId: state("completed") });
    expect((await row(project.id)).nextIssue).toBeNull();
    await updateIssue(blocker.id, { stateId: state("completed") });
    expect((await row(project.id)).nextIssue?.seq).toBe(blocked.seq);
  });

  it("shows empty projects honestly and reads activity without mutating stored data", async () => {
    const { project } = await fixture("DEMPTY");
    expect(await row(project.id)).toMatchObject({ total: 0, completed: 0, started: 0, percent: null, nextIssue: null });
    const ticket = await createIssue({ projectId: project.id, title: "Actividad reciente" });
    await updateIssue(ticket.id, { title: "Última actividad" });
    const events = await listActivity(ticket.id);
    const latest = Math.max(...events.map((e) => e.createdAt.getTime()));
    const before = (await createBackup()).tables;
    expect((await row(project.id)).lastActivityAt?.getTime()).toBe(latest);
    expect((await createBackup()).tables).toEqual(before);
    expect((await row(project.id)).identifier).toBe("DEMPTY");
    expect((await row(project.id)).description).toBe("");
  });
});
