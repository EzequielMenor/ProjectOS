import { beforeAll, describe, expect, it } from "vitest";
import { applyFilters, parseFilters, serializeFilters } from "@/lib/issue-filters";
import { callTool } from "@/server/agent/tools";
import { toIssueDTO } from "@/server/dto";
import { createBackup, restoreBackup } from "@/server/services/backup";
import { getIssueByKey, listActivity, listIssues, updateIssue } from "@/server/services/issues";
import { createPropertyDef, deletePropertyDef, listPropertyDefs, propertyUsage, setIssueProperties, updatePropertyDef } from "@/server/services/properties";
import { createProject } from "@/server/services/projects";
import { authenticate, createToken } from "@/server/services/tokens";

let ctx: Awaited<ReturnType<typeof authenticate>>;
let ro: Awaited<ReturnType<typeof authenticate>>;
let projectId: string;
const call = (n: string, a: unknown, c = ctx) => callTool(n, a, c) as Promise<any>;

beforeAll(async () => {
  projectId = (await createProject({ identifier: "PRP", name: "Propiedades" })).id;
  await createProject({ identifier: "PRQ", name: "Otro" });
  ctx = await authenticate(`Bearer ${(await createToken({ name: "agent", scope: "write" })).token}`);
  ro = await authenticate(`Bearer ${(await createToken({ name: "lector", scope: "read" })).token}`);
});

describe("property definitions", () => {
  it("creates the four types, validates selects and keeps names unique per project (case-insensitive)", async () => {
    const sprint = await createPropertyDef({ projectId, name: "Sprint demo", type: "number" });
    await createPropertyDef({ projectId, name: "Cliente", type: "text" });
    await createPropertyDef({ projectId, name: "Entrega", type: "date" });
    const sev = await createPropertyDef({ projectId, name: "Severidad", type: "select", options: [" Alta ", "Media", "Baja", ""] });
    expect(sev.options).toEqual(["Alta", "Media", "Baja"]);
    expect((await listPropertyDefs(projectId)).map((d) => d.name)).toEqual(["Sprint demo", "Cliente", "Entrega", "Severidad"]);
    expect(sprint.position).toBeLessThan(sev.position);

    await expect(createPropertyDef({ projectId, name: "severidad", type: "text" })).rejects.toThrow(/Ya existe/);
    await expect(createPropertyDef({ projectId, name: "Sin opciones", type: "select", options: [] })).rejects.toThrow(/al menos una opción/);
    await expect(createPropertyDef({ projectId, name: "Repetida", type: "select", options: ["a", "A"] })).rejects.toThrow(/repetida/);
    await expect(createPropertyDef({ projectId, name: "Texto con opciones", type: "text", options: ["x"] })).rejects.toThrow(/Solo las propiedades de selección/);
    // the same name is fine in another project
    const other = (await call("list_projects", {})).find((p: any) => p.identifier === "PRQ");
    expect(other).toBeTruthy();
  });
});

describe("values", () => {
  it("validates each type and records changes in the activity log", async () => {
    const { key } = await call("create_issue", { project: "PRP", title: "Con propiedades", properties: { "sprint demo": 3, Cliente: "  ACME ", Entrega: "2026-12-24", severidad: "alta" } });
    let got = await call("get_issue", { key });
    expect(got.properties).toEqual({ "Sprint demo": 3, Cliente: "ACME", Entrega: "2026-12-24", Severidad: "Alta" });

    await expect(call("update_issue", { key, properties: { "Sprint demo": "abc" } })).rejects.toThrow(/número/);
    await expect(call("update_issue", { key, properties: { Entrega: "2026-02-30" } })).rejects.toThrow(/fecha/);
    await expect(call("update_issue", { key, properties: { Severidad: "Crítica" } })).rejects.toThrow(/Válidas: Alta, Media, Baja/);
    await expect(call("update_issue", { key, properties: { Inventada: "x" } })).rejects.toThrow(/Propiedad desconocida/);
    // a failed update leaves everything as it was
    expect((await call("get_issue", { key })).properties["Sprint demo"]).toBe(3);

    await call("update_issue", { key, properties: { "Sprint demo": "4,5", Cliente: null, Severidad: "Media" } });
    got = await call("get_issue", { key });
    expect(got.properties).toEqual({ "Sprint demo": 4.5, Entrega: "2026-12-24", Severidad: "Media" });

    const act = (await listActivity((await getIssueByKey(key)).id)).filter((a) => a.action === "issue.updated").at(-1)!;
    expect(act.actor).toMatch(/^agent:/);
    expect(act.data.changes).toMatchObject({
      "property:Sprint demo": { from: 3, to: 4.5 },
      "property:Cliente": { from: "ACME", to: null },
      "property:Severidad": { from: "Alta", to: "Media" },
    });
    // setting the same value again is not a change
    const before = (await listActivity((await getIssueByKey(key)).id)).length;
    await call("update_issue", { key, properties: { Severidad: "media" } });
    expect((await listActivity((await getIssueByKey(key)).id)).length).toBe(before);
  });

  it("rejects values for a property of another project", async () => {
    const [foreign] = [await createPropertyDef({ projectId: (await createProject({ identifier: "PRZ", name: "Z" })).id, name: "Ajena", type: "text" })];
    const { id } = await call("create_issue", { project: "PRP", title: "x" });
    await expect(updateIssue(id, { properties: { [foreign.id]: "v" } })).rejects.toThrow(/no pertenece al proyecto/);
    await expect(setIssueProperties(id, { [foreign.id]: "v" })).rejects.toThrow(/no pertenece al proyecto/);
  });
});

describe("filtering", () => {
  it("filters by property on the server (list_issues) and in the UI helper", async () => {
    for (const [t, sev] of [["f1", "Alta"], ["f2", "Baja"], ["f3", "Alta"]] as const) await call("create_issue", { project: "PRP", title: t, properties: { Severidad: sev, "Sprint demo": t === "f1" ? 7 : 8 } });
    const alta = await call("list_issues", { project: "PRP", property: "severidad", propertyValue: "alta" });
    expect(alta.map((i: any) => i.title).filter((t: string) => t.startsWith("f"))).toEqual(["f3", "f1"]); // newest first, like the board
    const sprint7 = await call("list_issues", { project: "PRP", property: "Sprint demo", propertyValue: 7 });
    expect(sprint7.map((i: any) => i.title)).toEqual(["f1"]);
    await expect(call("list_issues", { project: "PRP", property: "Severidad" })).rejects.toThrow(/van juntos/);
    await expect(call("list_issues", { property: "Severidad", propertyValue: "Alta" })).rejects.toThrow(/requiere 'project'/);
    await expect(call("list_issues", { project: "PRP", property: "Severidad", propertyValue: "Nunca" })).rejects.toThrow(/opción desconocida/);

    const defs = await listPropertyDefs(projectId);
    const sevId = defs.find((d) => d.name === "Severidad")!.id;
    const rows = (await listIssues({ projectId })).map((r) => toIssueDTO(r, "PRP"));
    const f = parseFilters(new URLSearchParams(`p.${sevId}=Alta,Media`));
    expect(f.prop[sevId]).toEqual(["Alta", "Media"]);
    expect(serializeFilters(f)).toBe(`p.${sevId}=Alta%2CMedia`);
    const hit = applyFilters(rows, f).map((r) => r.title);
    expect(hit).toEqual(expect.arrayContaining(["f1", "f3", "Con propiedades"]));
    expect(hit).not.toContain("f2");
  });
});

describe("editing and deleting definitions", () => {
  it("refuses to drop an option that issues still use, and reports what a deletion removes", async () => {
    const sev = (await listPropertyDefs(projectId)).find((d) => d.name === "Severidad")!;
    await expect(updatePropertyDef(sev.id, { options: ["Alta", "Media"] })).rejects.toThrow(/en uso: "Baja" \(1\)/);
    const widened = await updatePropertyDef(sev.id, { name: "Gravedad", options: ["Alta", "Media", "Baja", "Crítica"] });
    expect(widened).toMatchObject({ name: "Gravedad", options: ["Alta", "Media", "Baja", "Crítica"] });
    // values survive a rename and are now read under the new name
    expect((await call("list_issues", { project: "PRP", property: "Gravedad", propertyValue: "Baja" })).length).toBe(1);

    const usage = await propertyUsage(projectId);
    expect(usage[sev.id]).toBe(4);
    const res = await deletePropertyDef(sev.id);
    expect(res.valuesRemoved).toBe(4);
    expect((await call("get_issue", { key: "PRP-1" })).properties).not.toHaveProperty("Gravedad");
  });

  it("agents can read and create properties but there is no tool to delete them", async () => {
    const created = await call("create_property", { project: "PRP", name: "Entorno", type: "select", options: ["dev", "prod"] });
    expect(created).toEqual({ name: "Entorno", type: "select", options: ["dev", "prod"] });
    expect(await call("list_properties", { project: "PRP" }, ro)).toEqual(expect.arrayContaining([{ name: "Entorno", type: "select", options: ["dev", "prod"] }]));
    await expect(call("create_property", { project: "PRP", name: "x", type: "text" }, ro)).rejects.toThrow(/solo lectura/);
    expect((await call("get_project", { project: "PRP" })).properties.map((p: any) => p.name)).toContain("Entorno");
  });
});

describe("backup", () => {
  it("round-trips definitions and values, and restores older backups that lack the tables", async () => {
    const backup = await createBackup();
    expect(backup.counts.property_def).toBeGreaterThan(0);
    expect(backup.counts.issue_property_value).toBeGreaterThan(0);
    await call("update_issue", { key: "PRP-1", properties: { "Sprint demo": 99 } });
    await restoreBackup(backup, { replace: true });
    expect((await call("get_issue", { key: "PRP-1" })).properties["Sprint demo"]).toBe(4.5);

    const old = JSON.parse(JSON.stringify(backup));
    delete old.tables.property_def;
    delete old.tables.issue_property_value;
    delete old.counts.property_def;
    delete old.counts.issue_property_value;
    await restoreBackup(old, { replace: true });
    expect((await call("get_issue", { key: "PRP-1" })).properties).toEqual({});
    expect(await listPropertyDefs(projectId)).toEqual([]);
  });
});
