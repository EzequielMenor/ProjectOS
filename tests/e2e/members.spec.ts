import { expect, test, type Page } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function newToken(page: Page, name: string) {
  await page.goto("/settings/tokens");
  await page.getByPlaceholder("claude-code").fill(name);
  await page.getByLabel("Permiso").selectOption("write");
  await page.getByRole("button", { name: "Crear token" }).click();
  return (await page.getByTestId("new-token").innerText()).trim();
}

/** Opens a picker, chooses an option and waits for the popover to be fully gone (exit animation). */
async function choose(page: Page, trigger: ReturnType<Page["getByRole"]>, option: string) {
  await trigger.click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(page.locator("[data-slot=popover-content]")).toHaveCount(0);
}

test("miembros y asignados: crear, asignar, filtrar, agentes por MCP y borrar", async ({ page, baseURL }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 300)));

  await page.goto("/projects/new");
  await page.getByPlaceholder("Fichaje").fill("Equipo");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await page.waitForURL(/\/EQUI\/list/);
  for (const t of ["Alfa", "Beta", "Gamma"]) {
    await page.getByRole("button", { name: /Nuevo issue/ }).click();
    await page.getByLabel("Título del nuevo issue").fill(t);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: t })).toBeVisible();
  }
  // seqs: Alfa = 1, Beta = 2, Gamma = 3

  // ---- settings: the owner exists; add a person and an agent; names are unique; rename
  await page.goto("/settings/members");
  const panel = page.getByRole("region", { name: "Miembros" });
  const rowOf = (name: string) => panel.getByTestId("member-row").filter({ has: page.getByLabel(`Nombre de ${name}`) });
  await expect(rowOf("Yo")).toHaveCount(1);
  const add = async (name: string, kind: "human" | "agent") => {
    await panel.getByLabel("Nombre del nuevo miembro").fill(name);
    await panel.getByLabel("Tipo del nuevo miembro").selectOption(kind);
    await panel.getByRole("button", { name: "Añadir" }).click();
    await expect(panel.getByLabel(`Nombre de ${name}`)).toBeVisible();
  };
  await add("Marta", "human");
  await add("Robo", "agent");
  await panel.getByLabel("Nombre del nuevo miembro").fill("marta");
  await panel.getByRole("button", { name: "Añadir" }).click();
  await expect(page.getByText(/Ya hay un miembro llamado/)).toBeVisible();
  await panel.getByLabel("Nombre del nuevo miembro").fill("");
  await panel.getByLabel("Nombre de Robo").fill("Robot");
  await panel.getByLabel("Nombre de Robo").press("Enter");
  await expect(panel.getByLabel("Nombre de Robot")).toBeVisible();
  await expect(rowOf("Robot")).toContainText("Agente");

  // ---- detail: assign from the picker; the activity log names the member; it survives a reload
  await page.goto("/EQUI/issues/1");
  const aside = page.getByRole("complementary", { name: "Propiedades" });
  await expect(aside.getByRole("button", { name: "Asignado" })).toContainText("—");
  await choose(page, aside.getByRole("button", { name: "Asignado" }), "Marta");
  await expect(aside.getByRole("button", { name: "Asignado" })).toContainText("Marta");
  await expect(page.getByText("cambió asignado a: — → Marta")).toBeVisible();
  await page.reload();
  await expect(aside.getByRole("button", { name: "Asignado" })).toContainText("Marta");

  // ---- an agent assigns by name over MCP; unknown names list the valid ones
  const token = await newToken(page, "equipo");
  const agent = new Client({ name: "e2e", version: "0" });
  await agent.connect(new StreamableHTTPClientTransport(new URL("/api/mcp", baseURL), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const ok: any = await agent.callTool({ name: "update_issue", arguments: { key: "EQUI-2", assignee: "robot" } });
  expect(ok.isError).toBeFalsy();
  const bad: any = await agent.callTool({ name: "update_issue", arguments: { key: "EQUI-2", assignee: "Fantasma" } });
  expect(bad.isError).toBe(true);
  expect(bad.content[0].text).toContain("Válidos:");
  const members: any = await agent.callTool({ name: "list_members", arguments: {} });
  expect(members.content[0].text).toContain("Marta");
  const mine: any = await agent.callTool({ name: "list_issues", arguments: { project: "EQUI", assignee: "Robot" } });
  expect(mine.content[0].text).toContain("EQUI-2");
  expect(mine.content[0].text).not.toContain("EQUI-1");
  await agent.close();

  // ---- table: column, values, inline change
  await page.goto("/EQUI/table");
  const table = page.getByTestId("issue-table");
  await expect(table.getByRole("columnheader", { name: "Asignado" })).toBeVisible();
  const cell = (title: string) => table.locator("tr", { hasText: title }).locator("td[data-cell=assignee]");
  await expect(cell("Alfa")).toContainText("Marta");
  await expect(cell("Beta")).toContainText("Robot");
  await expect(cell("Gamma")).toContainText("—");

  // ---- filter by assignee: «Sin asignar», a member, both; lives in the URL and survives reload
  const filter = page.getByRole("toolbar", { name: "Filtros" }).getByRole("button", { name: "Filtrar por asignado" });
  await filter.click();
  await page.getByRole("option", { name: "Sin asignar" }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-slot=popover-content]")).toHaveCount(0);
  await expect(page.getByTestId("issue-row")).toHaveCount(1);
  await expect(page.getByTestId("issue-row")).toContainText("Gamma");
  await expect(page).toHaveURL(/assignee=none/);
  await filter.click();
  await page.getByRole("option", { name: "Marta" }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-slot=popover-content]")).toHaveCount(0);
  await expect(page.getByTestId("issue-row")).toHaveCount(2);
  await page.reload();
  await expect(page.getByTestId("issue-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Limpiar" }).click();
  await expect(page.getByTestId("issue-row")).toHaveCount(3);

  // inline change from the table
  await choose(page, table.locator("tr", { hasText: "Gamma" }).getByRole("button", { name: "Asignado" }), "Robot");
  await expect(cell("Gamma")).toContainText("Robot");

  // ---- list and board show who holds each issue
  await page.goto("/EQUI/list");
  await expect(page.getByTestId("issue-row").filter({ hasText: "Alfa" }).getByRole("img", { name: "Marta" })).toBeVisible();
  await page.goto("/EQUI/board");
  await expect(page.getByTestId("issue-card").filter({ hasText: "Beta" }).getByRole("img", { name: "Robot" })).toBeVisible();

  // ---- deleting a member (human only, with confirmation) leaves its issues unassigned
  await page.goto("/settings/members");
  const row = rowOf("Marta");
  await expect(row).toContainText("1 issue");
  await row.getByRole("button", { name: "Borrar Marta" }).click();
  await expect(page.getByRole("group", { name: "Confirmar borrado de Marta" })).toContainText("su issue quedará sin asignar");
  await page.getByRole("button", { name: "Borrar miembro" }).click();
  await expect(rowOf("Marta")).toHaveCount(0);
  await page.goto("/EQUI/issues/1");
  await expect(aside.getByRole("button", { name: "Asignado" })).toContainText("—");
  await expect(page.getByText("Alfa").first()).toBeVisible();

  expect(errors, errors.join("\n")).toEqual([]);
});
