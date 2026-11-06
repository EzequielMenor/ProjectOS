import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("dashboard: progreso, siguiente paso y vistas conservan la búsqueda", async ({ page, request }) => {
  await page.goto("/settings/tokens");
  await page.getByPlaceholder("claude-code").fill("dashboard-e2e");
  await page.getByLabel("Permiso").selectOption("write");
  await page.getByRole("button", { name: "Crear token" }).click();
  const token = (await page.getByTestId("new-token").innerText()).trim();
  const call = async (name: string, data: Record<string, unknown>) => {
    const response = await request.post(`/api/v1/tools/${name}`, { headers: { Authorization: `Bearer ${token}` }, data });
    expect(response.ok()).toBeTruthy();
    return (await response.json()).result;
  };
  await call("create_project", { identifier: "DBA", name: "Dashboard Alfa" });
  await call("create_project", { identifier: "DBB", name: "Dashboard Beta" });
  const done = await call("create_issue", { project: "DBA", title: "Tarea terminada" });
  await call("complete_issue", { key: done.key });
  const next = await call("create_issue", { project: "DBA", title: "Siguiente tarea" });
  await page.goto("/projects?q=Dashboard");
  const rows = page.getByTestId("project-row");
  const alpha = rows.filter({ has: page.getByRole("link", { name: "Dashboard Alfa", exact: true }) });
  const beta = rows.filter({ has: page.getByRole("link", { name: "Dashboard Beta", exact: true }) });
  await expect(alpha).toContainText("1 de 2");
  await expect(alpha.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  await expect(alpha).toContainText("0 en marcha");
  await expect(alpha.locator("time")).toHaveAttribute("datetime", /.+/);
  await expect(alpha.getByRole("link", { name: /Siguiente tarea/ })).toHaveAttribute("href", `/DBA/issues/${next.key.split("-")[1]}`);
  await expect(beta).toContainText("Sin tareas");
  await expect(beta.getByRole("progressbar")).toHaveCount(0);
  await expect(beta).toContainText("Sin trabajo pendiente disponible");
  await alpha.getByLabel("Estado de Dashboard Alfa").selectOption("paused");
  await expect(page.getByText("Dashboard Alfa: Pausado")).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Vistas de proyectos" });
  await nav.getByRole("link", { name: /^Pausados/ }).click();
  await expect(page.getByRole("searchbox", { name: "Buscar" })).toHaveValue("Dashboard");
  await expect(nav.getByRole("link", { name: /^Pausados/ })).toHaveAttribute("aria-current", "page");
  await expect(rows).toHaveCount(1);
  for (const [label, count] of [["En marcha", 0], ["Planificados", 1], ["Terminados", 0], ["Cancelados", 0], ["Archivados", 0], ["Todos", 2], ["En seguimiento", 2]] as const) {
    await nav.getByRole("link", { name: new RegExp(`^${label}`) }).click();
    await expect(page.getByRole("searchbox", { name: "Buscar" })).toHaveValue("Dashboard");
    await expect(rows).toHaveCount(count);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
});

for (const theme of ["light", "dark"] as const) {
  test(`dashboard: accesibilidad ${theme}`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    await page.goto("/projects?q=Dashboard");
    await page.waitForLoadState("networkidle");
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  });
}
