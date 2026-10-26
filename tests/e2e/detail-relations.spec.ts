import { expect, test } from "@playwright/test";

test("detalle: etiquetas, subtareas, padre, relaciones, fecha y estimación", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByPlaceholder("Fichaje").fill("Relaciones");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await page.waitForURL(/\/RELA\/list/);
  for (const t of ["Base de datos", "API de fichajes", "Panel"]) {
    await page.getByRole("button", { name: /Nuevo issue/ }).click();
    await page.getByLabel("Título del nuevo issue").fill(t);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: t })).toBeVisible();
  }
  // seq follows creation order: RELA-1 Base de datos, RELA-2 API, RELA-3 Panel
  await page.goto("/RELA/issues/2");
  const props = page.getByRole("complementary", { name: "Propiedades" });

  // labels: create from the picker, then it is applied
  await props.getByRole("button", { name: "Etiquetas" }).click();
  await page.getByPlaceholder("Etiquetas…").fill("backend");
  await page.getByRole("option", { name: /Crear “backend”/ }).click();
  await expect(props).toContainText("backend");
  await page.keyboard.press("Escape");

  // subtask
  await page.getByLabel("Nueva subtarea").fill("Esquema de tablas");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Subtareas" }).getByRole("link", { name: /Esquema de tablas/ })).toBeVisible();

  // relation: this issue is blocked by RELA-1
  await page.getByRole("button", { name: "Añadir relación" }).click();
  await page.getByRole("option", { name: /RELA-1/ }).click();
  const rel = page.getByRole("region", { name: "Relaciones" });
  await expect(rel.getByText("Bloqueado por", { exact: true }).first()).toBeVisible();
  await expect(rel.getByRole("link", { name: /Base de datos/ })).toBeVisible();

  // the other side sees "Bloquea a"
  await page.goto("/RELA/issues/1");
  await expect(page.getByRole("region", { name: "Relaciones" }).getByRole("link", { name: /API de fichajes/ })).toBeVisible();

  // parent from the picker on RELA-3, then removal
  await page.goto("/RELA/issues/3");
  await props.getByRole("button", { name: "Elegir padre" }).click();
  await page.getByRole("option", { name: /RELA-2/ }).click();
  await expect(props.getByRole("link", { name: "RELA-2" })).toBeVisible();
  await props.getByRole("button", { name: "Quitar padre" }).click();
  await expect(props.getByRole("button", { name: "Elegir padre" })).toBeVisible();

  // date + estimate persist across reload
  await props.getByLabel("Fecha límite").fill("2026-12-01");
  await props.getByLabel("Estimación").fill("5");
  await props.getByLabel("Estimación").blur();
  await expect(page.getByLabel("Actividad")).toContainText("estimación");
  await page.reload();
  await expect(props.getByLabel("Fecha límite")).toHaveValue("2026-12-01");
  await expect(props.getByLabel("Estimación")).toHaveValue("5");

  // remove the relation from the blocked side
  await page.goto("/RELA/issues/2");
  await page.getByRole("button", { name: "Quitar relación con RELA-1" }).click();
  await expect(page.getByRole("region", { name: "Relaciones" }).getByRole("link", { name: /Base de datos/ })).toHaveCount(0);

  // label shows on the list
  await page.goto("/RELA/list");
  await expect(page.getByText("backend")).toBeVisible();
});
