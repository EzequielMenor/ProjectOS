import { expect, test } from "@playwright/test";

test("filtros, vista de tabla y vistas guardadas", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByPlaceholder("Fichaje").fill("Filtros");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await page.waitForURL(/\/FILT\/list/);
  for (const t of ["Alfa", "Beta", "Gamma"]) {
    await page.getByRole("button", { name: /Nuevo issue/ }).click();
    await page.getByLabel("Título del nuevo issue").fill(t);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: t })).toBeVisible();
  }
  // Beta → urgent, Gamma → high
  const prio = async (title: string, label: string) => {
    await page.getByTestId("issue-row").filter({ hasText: title }).getByRole("button", { name: "Prioridad" }).click();
    await page.getByRole("option", { name: label }).click();
  };
  await prio("Beta", "Urgente");
  await prio("Gamma", "Alta");
  await expect(page.getByTestId("issue-row").filter({ hasText: "Beta" }).getByRole("button", { name: "Prioridad" })).toBeVisible();

  // priority filter
  await page.getByRole("button", { name: "Filtrar por prioridad" }).click();
  await page.getByRole("option", { name: "Urgente" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("issue-row")).toHaveCount(1);
  await expect(page.getByText("1 de 3 issues")).toBeVisible();
  await expect(page).toHaveURL(/priority=urgent/);

  // filter survives a reload (it lives in the URL) and carries over to the table
  await page.reload();
  await expect(page.getByTestId("issue-row")).toHaveCount(1);
  await page.getByRole("navigation", { name: "Vista" }).getByRole("link", { name: "Tabla" }).click();
  await page.waitForURL(/\/FILT\/table\?priority=urgent/);
  await expect(page.getByTestId("issue-row")).toHaveCount(1);
  await expect(page.getByTestId("issue-table")).toContainText("Beta");

  // save the view, clear filters, and come back through the saved view
  await page.getByRole("button", { name: "Vistas guardadas" }).click();
  await page.getByLabel("Nombre de la vista").fill("Urgentes");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Vista “Urgentes” guardada")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Limpiar" }).click();
  await expect(page.getByTestId("issue-row")).toHaveCount(3);
  await page.getByRole("button", { name: "Vistas guardadas" }).click();
  await page.getByRole("link", { name: /Urgentes/ }).click();
  await page.waitForURL(/\/FILT\/table\?priority=urgent/);
  await expect(page.getByTestId("issue-row")).toHaveCount(1);

  // table sorting by title, and the text filter
  await page.getByRole("button", { name: "Limpiar" }).click();
  await page.getByRole("button", { name: "Título" }).click();
  await expect(page.getByTestId("issue-row").first()).toContainText("Alfa");
  await page.getByRole("button", { name: "Título" }).click();
  await expect(page.getByTestId("issue-row").first()).toContainText("Gamma");
  await page.getByLabel("Filtrar por texto").fill("zzz");
  await expect(page.getByText("Ningún issue coincide con los filtros")).toBeVisible();
  await page.getByRole("button", { name: "Limpiar filtros" }).click();
  await expect(page.getByTestId("issue-row")).toHaveCount(3);

  // views are reversible bookmarks: delete one
  await page.getByRole("button", { name: "Vistas guardadas" }).click();
  await page.getByRole("button", { name: "Eliminar vista Urgentes" }).click();
  await expect(page.getByText("Aún no hay vistas guardadas")).toBeVisible();
});
