import { expect, test } from "@playwright/test";

test("épicas: crear, subtareas con progreso, y convertir un issue en épica", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByPlaceholder("Fichaje").fill("Epicas");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await page.waitForURL(/\/EPIC\/list/);

  await page.getByRole("link", { name: "Épicas" }).click();
  await page.waitForURL(/\/EPIC\/epics/);
  await expect(page.getByText("Aún no hay épicas")).toBeVisible();

  await page.getByLabel("Título de la nueva épica").fill("Release 1");
  await page.getByRole("button", { name: "Crear épica" }).click();
  const row = page.getByTestId("epic-row").filter({ hasText: "Release 1" });
  await expect(row).toContainText("Sin subtareas");

  // open it and add two sub-tasks
  await row.getByRole("link", { name: "Release 1" }).click();
  await page.waitForURL(/\/EPIC\/issues\/1/);
  await expect(page.getByRole("complementary", { name: "Propiedades" })).toContainText("Épica");
  for (const t of ["Primera", "Segunda"]) {
    await page.getByLabel("Nueva subtarea").fill(t);
    await page.getByLabel("Nueva subtarea").press("Enter");
    await expect(page.getByRole("region", { name: "Subtareas" }).getByRole("link", { name: new RegExp(t) })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "Subtareas" }).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");

  // finish one of them
  await page.goto("/EPIC/issues/2");
  await expect(page.getByLabel("Título")).toHaveValue("Primera");
  await page.getByRole("complementary", { name: "Propiedades" }).getByRole("button", { name: "Estado" }).click();
  await page.getByRole("option", { name: "Done" }).click();
  await expect(page.getByRole("complementary", { name: "Propiedades" })).toContainText("Done");

  await page.goto("/EPIC/epics");
  const bar = page.getByTestId("epic-row").filter({ hasText: "Release 1" }).getByRole("progressbar");
  await expect(bar).toHaveAttribute("aria-valuenow", "50");
  await page.getByTestId("epic-row").filter({ hasText: "Release 1" }).locator("summary > svg").first().click(); // expand with the chevron (the title is a link)
  await expect(page.getByTestId("epic-row").getByRole("link", { name: /Segunda/ })).toBeVisible();

  // a plain issue becomes an epic from its detail page, and shows the badge on the board
  await page.goto("/EPIC/issues/3");
  await expect(page.getByRole("heading", { name: "Subtareas" })).toBeVisible();
  await page.getByRole("complementary", { name: "Propiedades" }).getByRole("button", { name: "Tipo" }).click();
  await page.getByRole("option", { name: "Épica" }).click();
  await expect(page.getByRole("complementary", { name: "Propiedades" })).toContainText("Épica");
  await page.goto("/EPIC/epics");
  await expect(page.getByTestId("epic-row")).toHaveCount(2);
  await page.goto("/EPIC/list");
  await expect(page.getByText("Épica", { exact: true })).toHaveCount(2);
});
