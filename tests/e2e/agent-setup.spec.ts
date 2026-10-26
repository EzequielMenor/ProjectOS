import { expect, test } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

test("tokens: la sección «Configurar en el agente» se rellena con el token y la configuración mostrada funciona", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 300)));

  await page.goto("/projects/new");
  await page.getByPlaceholder("Fichaje").fill("Conexión");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await page.waitForURL(/\/CONE\/list/);

  await page.goto("/settings/tokens");
  const setup = page.getByRole("region", { name: "Configurar en el agente" });
  const text = () => setup.getByTestId("setup-text").first().innerText();

  // before creating a token: placeholder, same layout
  await expect(setup).toContainText("pos_XXXX");
  expect(await text()).toContain("claude mcp add --transport http --scope user projectos");

  // create a write token: the section now holds it
  await page.getByPlaceholder("claude-code").fill("agente-conexion");
  await page.getByLabel("Permiso").selectOption("write");
  await page.getByRole("button", { name: "Crear token" }).click();
  const token = (await page.getByTestId("new-token").innerText()).trim();
  expect(token).toMatch(/^pos_/);
  await expect(setup).toContainText("Ya incluye tu token nuevo");
  await expect.poll(text).toContain(`Bearer ${token}`);
  expect(await text()).toContain(`${baseURL}/api/mcp`);

  // copy button
  await setup.getByRole("button", { name: "Copiar: Comando de Claude Code" }).click();
  await expect(setup.getByRole("button", { name: /Copiar/ }).first()).toContainText("Copiado");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await text());

  // tabs (keyboard works): the JSON is valid and is what an agent can actually connect with
  await setup.getByRole("tab", { name: "Claude Code" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(setup.getByRole("tab", { name: "Otros clientes MCP" })).toHaveAttribute("aria-selected", "true");
  const cfg = JSON.parse(await text()).mcpServers.projectos;
  expect(cfg.url).toBe(`${baseURL}/api/mcp`);
  const agent = new Client({ name: "setup-e2e", version: "0" });
  await agent.connect(new StreamableHTTPClientTransport(new URL(cfg.url), { requestInit: { headers: cfg.headers } }));
  const projects: any = await agent.callTool({ name: "list_projects", arguments: {} });
  expect(projects.content[0].text).toContain("CONE");
  await agent.close();

  // the prompt carries the token, the steps and the repo snippet
  await setup.getByRole("tab", { name: "Prompt para el agente" }).click();
  const prompt = await text();
  expect(prompt).toContain(token);
  for (const needle of ["list_projects", "create_member", "CLAUDE.md", "--scope user", "no escribas el token"]) expect(prompt).toContain(needle);

  // a read-only token produces a prompt without write steps
  await page.getByPlaceholder("claude-code").fill("lector-conexion");
  await page.getByLabel("Permiso").selectOption("read");
  await page.getByRole("button", { name: "Crear token" }).click();
  await expect(page.getByTestId("new-token")).not.toContainText(token);
  await setup.getByRole("tab", { name: "Prompt para el agente" }).click();
  await expect.poll(text).toContain("solo lectura");
  expect(await text()).not.toContain("create_member");

  expect(errors, errors.join("\n")).toEqual([]);
});
