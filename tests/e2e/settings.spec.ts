import { expect, test } from "@playwright/test";

test("ajustes: descripción del proyecto y gestión de estados", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByPlaceholder("Fichaje").fill("Flujos");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await page.waitForURL(/\/FLUJ\/list/);
  await page.getByRole("button", { name: /Nuevo issue/ }).click();
  await page.getByLabel("Título del nuevo issue").fill("Una tarea");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: "Una tarea" })).toBeVisible();

  await page.getByRole("link", { name: "Ajustes" }).click();
  await page.waitForURL(/\/FLUJ\/settings/);

  // project description
  await page.getByLabel("Descripción del proyecto").fill("Notas del proyecto");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Proyecto guardado")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Descripción del proyecto")).toHaveValue("Notas del proyecto");

  // new state shows up as a board column
  const states = page.getByRole("region", { name: "Estados" });
  const row = (n: string) => states.getByTestId("state-row").filter({ has: page.getByLabel(`Nombre de ${n}`) });
  await states.getByLabel("Nombre del nuevo estado").fill("En revisión");
  await states.getByRole("button", { name: "Añadir" }).click();
  await expect(states.getByTestId("state-row")).toHaveCount(6);
  await page.goto("/FLUJ/board");
  await expect(page.getByRole("region", { name: "En revisión" })).toBeVisible();

  // rename, then move the issue into it from the board's detail and delete the state moving it elsewhere
  await page.goto("/FLUJ/settings");
  const name = states.getByLabel("Nombre de En revisión");
  await name.fill("Revisión QA");
  await name.press("Enter");
  await expect(states.getByLabel("Nombre de Revisión QA")).toBeVisible();

  await page.goto("/FLUJ/issues/1");
  await page.getByRole("complementary", { name: "Propiedades" }).getByRole("button", { name: "Estado" }).click();
  await page.getByRole("option", { name: "Revisión QA" }).click();
  await expect(page.getByRole("complementary", { name: "Propiedades" })).toContainText("Revisión QA");

  await page.goto("/FLUJ/settings");
  await expect(row("Revisión QA")).toContainText("1 issue");
  await states.getByRole("button", { name: "Borrar Revisión QA" }).click();
  await states.getByLabel("Estado de destino").selectOption({ label: "In Progress" });
  await states.getByRole("button", { name: "Mover y borrar" }).click();
  await expect(states.getByLabel("Nombre de Revisión QA")).toHaveCount(0);
  await expect(row("In Progress")).toContainText("1 issue");

  // guard rails surface as messages instead of breaking the flow
  await expect(states.getByRole("button", { name: "Borrar Todo" })).toBeDisabled(); // default state
  await states.getByLabel("Grupo de Done").selectOption("started");
  await expect(page.getByText(/al menos un estado de tipo 'completed'/)).toBeVisible();
});
