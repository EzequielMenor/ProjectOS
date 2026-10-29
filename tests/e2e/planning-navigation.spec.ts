import { expect, test } from "@playwright/test";

test("roadmap e hitos permiten recorrer objetivos, épicas, tickets y bloqueos sin fechas", async ({ page, request }) => {
  await page.goto("/settings/tokens");
  await page.getByPlaceholder("claude-code").fill("planning-navigation");
  await page.getByLabel("Permiso").selectOption("write");
  await page.getByRole("button", { name: "Crear token" }).click();
  const token = (await page.getByTestId("new-token").innerText()).trim();
  const call = async (name: string, args: Record<string, unknown>) => {
    const response = await request.post(`/api/v1/tools/${name}`, {
      headers: { Authorization: `Bearer ${token}` }, data: args,
    });
    expect(response.ok()).toBeTruthy();
    return (await response.json()).result;
  };
  await call("create_project", { identifier: "NAV", name: "Navegación" });
  await call("create_project", { identifier: "NAVOTHER", name: "Otro proyecto de navegación" });
  await call("create_milestone", { project: "NAV", name: "Colaboración segura", description: "Objetivo: compartir sin exponer datos." });
  await call("create_milestone", { project: "NAV", name: "Más adelante" });
  const epic = await call("create_issue", { project: "NAV", title: "Identidad del equipo", type: "epic" });
  const first = await call("create_issue", { project: "NAV", title: "Crear cuentas", parent: epic.key });
  const second = await call("create_issue", { project: "NAV", title: "Invitar personas", parent: epic.key });
  await call("create_issue", { project: "NAV", title: "Fuera de este hito" });
  for (const key of [epic.key, first.key, second.key]) {
    await call("assign_issue", { key, milestone: "Colaboración segura" });
  }
  await call("add_relation", { key: first.key, related: second.key, type: "blocks" });

  await page.goto("/NAV/roadmap");
  await expect(page.getByRole("heading", { name: "Sin fechas" })).toBeVisible();
  await page.getByRole("link", { name: "Colaboración segura", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Colaboración segura", exact: true })).toBeVisible();
  const detailURL = page.url();
  await expect(page.getByText("Objetivo: compartir sin exponer datos.")).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByRole("region", { name: "Épicas" }).getByRole("link", { name: /Identidad del equipo/ })).toBeVisible();
  const tickets = page.getByRole("region", { name: "Tickets" });
  await expect(tickets.getByRole("link", { name: /Invitar personas/ })).toBeVisible();
  await expect(tickets).toContainText("Bloqueado por");
  await expect(tickets.getByRole("link", { name: /Fuera de este hito/ })).toHaveCount(0);
  await tickets.getByRole("link", { name: /Invitar personas/ }).click();
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue("Invitar personas");
  await page.goto(detailURL);
  await page.getByRole("region", { name: "Épicas" }).getByRole("link", { name: /Identidad del equipo/ }).click();
  await expect(page.getByRole("region", { name: "Subtareas" }).getByRole("link", { name: /Crear cuentas/ })).toBeVisible();

  await page.goto("/NAV/milestones");
  await expect(page.getByText("Objetivo: compartir sin exponer datos.")).toBeVisible();
  await page.getByRole("link", { name: "Colaboración segura", exact: true }).click();
  await expect(page).toHaveURL(detailURL);
  await page.getByRole("link", { name: "Hitos", exact: true }).last().click();
  await page.getByRole("link", { name: "Más adelante", exact: true }).click();
  await expect(page.getByText("Todavía no hay trabajo asignado.")).toBeVisible();

  await call("complete_issue", { key: first.key });
  await page.goto(detailURL);
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");
  await expect(page.getByText("Bloqueado por")).toHaveCount(0);
  const missing = await page.goto("/NAV/planning/milestone/00000000-0000-4000-8000-000000000000");
  expect(missing?.status()).toBe(404);
  const foreign = await page.goto(detailURL.replace("/NAV/", "/NAVOTHER/"));
  expect(foreign?.status()).toBe(404);
  await page.goto(detailURL);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Colaboración segura", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
