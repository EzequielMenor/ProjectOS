import { expect, test, type Page } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function newToken(page: Page, name: string, scope: "read" | "write") {
  await page.goto("/settings/tokens");
  await page.getByPlaceholder("claude-code").fill(name);
  await page.getByLabel("Permiso").selectOption(scope);
  await page.getByRole("button", { name: "Crear token" }).click();
  return (await page.getByTestId("new-token").innerText()).trim();
}

async function connect(baseURL: string, token: string) {
  const client = new Client({ name: "e2e", version: "0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL("/api/mcp", baseURL), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }),
  );
  return client;
}

const text = (r: any) => r.content[0].text as string;

test("MCP: un agente gestiona issues y la UI lo refleja; permisos respetados", async ({ page, baseURL }) => {
  await page.goto("/projects/new");
  await page.getByPlaceholder("Fichaje").fill("Agente MCP");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await page.waitForURL(/\/AGEN\/list/);

  const write = await newToken(page, "claude-code", "write");
  const read = await newToken(page, "solo-lectura", "read");
  expect(write).toMatch(/^pos_/);

  // No token -> rejected
  expect((await fetch(`${baseURL}/api/mcp`, { method: "POST" })).status).toBe(403);

  const agent = await connect(baseURL!, write);
  const names = (await agent.listTools()).tools.map((t) => t.name);
  expect(names).toContain("create_issue");
  expect(names.some((n) => /delete|remove/.test(n))).toBe(false);

  const created = JSON.parse(text(await agent.callTool({ name: "create_issue", arguments: { project: "AGEN", title: "Hecho por el agente", priority: "high" } })));
  expect(created.key).toBe("AGEN-1");
  await agent.callTool({ name: "set_state", arguments: { key: "AGEN-1", state: "In Progress" } });
  await agent.callTool({ name: "log_progress", arguments: { key: "AGEN-1", summary: "avance", evidence: [{ kind: "commit", url: "deadbeef" }] } });

  const bad = await agent.callTool({ name: "set_state", arguments: { key: "AGEN-1", state: "Nope" } });
  expect(bad.isError).toBe(true);
  expect(text(bad)).toContain("Válidos");

  // The UI sees the agent's work without any manual refresh of data
  await page.goto("/AGEN/board");
  await expect(page.getByRole("region", { name: "In Progress" }).getByTestId("issue-card")).toContainText("Hecho por el agente");
  await page.getByRole("link", { name: "Hecho por el agente" }).click();
  await expect(page.getByLabel("Actividad")).toContainText("agent:claude-code");
  await expect(page.getByLabel("Actividad")).toContainText("avance");

  // Read-only token: sees reads, has no write tools, and direct REST writes are refused
  const viewer = await connect(baseURL!, read);
  const viewerTools = (await viewer.listTools()).tools.map((t) => t.name);
  expect(viewerTools).toContain("get_issue");
  expect(viewerTools).not.toContain("create_issue");
  const rest = await fetch(`${baseURL}/api/v1/tools/create_issue`, {
    method: "POST",
    headers: { Authorization: `Bearer ${read}`, "content-type": "application/json" },
    body: JSON.stringify({ project: "AGEN", title: "no debería" }),
  });
  expect(rest.status).toBe(403);
  const ok = await fetch(`${baseURL}/api/v1/tools/next_work`, { method: "POST", headers: { Authorization: `Bearer ${read}` }, body: "{}" });
  expect((await ok.json()).result[0].key).toBe("AGEN-1");
  await agent.close();
  await viewer.close();
});
