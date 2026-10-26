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

test("propiedades personalizadas: crear, rellenar, ver en la tabla, filtrar y borrar", async ({ page, baseURL }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 300)));

  await page.goto("/projects/new");
  await page.getByPlaceholder("Fichaje").fill("Campos");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await page.waitForURL(/\/CAMP\/list/);
  for (const t of ["Primero", "Segundo", "Tercero"]) {
    await page.getByRole("button", { name: /Nuevo issue/ }).click();
    await page.getByLabel("Título del nuevo issue").fill(t);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: t })).toBeVisible();
  }

  // ---- settings: define one property of each type
  await page.goto("/CAMP/settings");
  const props = page.getByRole("region", { name: "Propiedades personalizadas" });
  await expect(props).toContainText("Aún no hay propiedades");
  const add = async (name: string, type: string, options?: string) => {
    await props.getByLabel("Nombre de la nueva propiedad").fill(name);
    await props.getByLabel("Tipo de la nueva propiedad").selectOption(type);
    if (options) await props.getByLabel("Opciones de la nueva propiedad").fill(options);
    await props.getByRole("button", { name: "Añadir" }).click();
    await expect(props.getByLabel(`Nombre de ${name}`)).toBeVisible();
  };
  await add("Severidad", "select", "Alta, Media, Baja");
  await add("Horas", "number");
  await add("Cliente", "text");
  await add("Entrega", "date");
  await expect(props.getByTestId("property-row")).toHaveCount(4);

  // a duplicate name is refused with a message
  await props.getByLabel("Nombre de la nueva propiedad").fill("severidad");
  await props.getByLabel("Tipo de la nueva propiedad").selectOption("text");
  await props.getByRole("button", { name: "Añadir" }).click();
  await expect(page.getByText(/Ya existe una propiedad/)).toBeVisible();

  // ---- detail: fill values (each editor type)
  await page.goto("/CAMP/issues/1"); // seq 1 is "Primero"
  const aside = page.getByRole("complementary", { name: "Propiedades" });
  await aside.getByRole("button", { name: "Severidad" }).click();
  await page.getByRole("option", { name: "Alta" }).click();
  await expect(aside.getByRole("button", { name: "Severidad" })).toContainText("Alta");
  await aside.getByLabel("Horas").fill("5");
  await aside.getByLabel("Horas").press("Enter");
  await aside.getByLabel("Cliente").fill("ACME");
  await aside.getByLabel("Cliente").press("Enter");
  await aside.getByLabel("Entrega").fill("2026-12-24");
  await page.getByText("cambió «Cliente»").waitFor();

  await page.goto("/CAMP/issues/2");
  await aside.getByRole("button", { name: "Severidad" }).click();
  await page.getByRole("option", { name: "Baja" }).click();
  await expect(aside.getByRole("button", { name: "Severidad" })).toContainText("Baja");
  await aside.getByLabel("Horas").fill("12");
  await aside.getByLabel("Horas").press("Enter");
  await expect(page.getByText("cambió «Horas»: — → 12")).toBeVisible();

  // values survive a reload and the activity log names the property
  await page.reload();
  await expect(aside.getByLabel("Horas")).toHaveValue("12");
  await expect(aside.getByRole("button", { name: "Severidad" })).toContainText("Baja");

  // ---- an agent sets a value over MCP; the UI shows it
  const token = await newToken(page, "propiedades");
  const agent = new Client({ name: "e2e", version: "0" });
  await agent.connect(new StreamableHTTPClientTransport(new URL("/api/mcp", baseURL), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const res: any = await agent.callTool({ name: "update_issue", arguments: { key: "CAMP-3", properties: { severidad: "media", Horas: 1.5 } } });
  expect(res.isError).toBeFalsy();
  const bad: any = await agent.callTool({ name: "update_issue", arguments: { key: "CAMP-3", properties: { Severidad: "Crítica" } } });
  expect(bad.isError).toBe(true);
  expect(bad.content[0].text).toContain("Válidas: Alta, Media, Baja");
  await agent.close();

  // ---- table: columns, values and sorting
  await page.goto("/CAMP/table");
  const table = page.getByTestId("issue-table");
  for (const h of ["Severidad", "Horas", "Cliente", "Entrega"]) await expect(table.getByRole("columnheader", { name: h })).toBeVisible();
  const hours = () => table.locator("td[data-property=Horas]").allInnerTexts();
  await table.getByRole("button", { name: "Horas" }).click(); // numeric, not alphabetical: 1.5 < 5 < 12
  await expect.poll(hours).toEqual(["1.5", "5", "12"]);
  await table.getByRole("button", { name: "Horas" }).click();
  await expect.poll(hours).toEqual(["12", "5", "1.5"]);
  await expect(table.locator("tr", { hasText: "Primero" }).locator("td[data-property=Cliente]")).toHaveText("ACME");
  await expect(table.locator("tr", { hasText: "Primero" }).locator("td[data-property=Entrega]")).toHaveText("2026-12-24");

  // ---- filter by the select property: lives in the URL, survives reload, combines with a saved view
  await page.getByRole("button", { name: "Filtrar por severidad" }).click();
  await page.getByRole("option", { name: "Alta" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("issue-row")).toHaveCount(1);
  await expect(page.getByText("1 de 3 issues")).toBeVisible();
  await expect(page).toHaveURL(/p\.[0-9a-f-]{36}=Alta/);
  await page.reload();
  await expect(page.getByTestId("issue-row")).toHaveCount(1);
  await expect(page.getByTestId("issue-row")).toContainText("Primero");
  await page.getByRole("button", { name: "Limpiar" }).click();
  await expect(page.getByTestId("issue-row")).toHaveCount(3);

  // ---- settings: options in use cannot be dropped; deleting says what is lost
  await page.goto("/CAMP/settings");
  const sev = props.getByLabel("Opciones de Severidad");
  await sev.fill("Alta, Media");
  await sev.press("Enter");
  await expect(page.getByText(/No se pueden quitar opciones en uso: "Baja" \(1\)/)).toBeVisible();
  await page.reload();
  await expect(props.getByLabel("Opciones de Severidad")).toHaveValue("Alta, Media, Baja");

  const row = props.getByTestId("property-row").filter({ has: page.getByLabel("Nombre de Cliente") });
  await expect(row).toContainText("1 issue");
  await props.getByRole("button", { name: "Borrar Cliente" }).click();
  await expect(props.getByRole("group", { name: "Borrar Cliente" })).toContainText("y su valor en 1 issue");
  await props.getByRole("button", { name: "Borrar propiedad" }).click();
  await expect(props.getByLabel("Nombre de Cliente")).toHaveCount(0);
  await page.goto("/CAMP/table");
  await expect(page.getByTestId("issue-table").getByRole("columnheader", { name: "Cliente" })).toHaveCount(0);

  expect(errors).toEqual([]);
});
