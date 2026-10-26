import { expect, test } from "@playwright/test";

test("el tablero y las vistas no producen errores de hidratación ni de consola", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 300)));
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/projects/new");
  await page.getByPlaceholder("Fichaje").fill("Hidrata");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await page.waitForURL(/\/HIDR\/list/);
  await page.getByRole("button", { name: /Nuevo issue/ }).click();
  await page.getByLabel("Título del nuevo issue").fill("Tarjeta");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: "Tarjeta" })).toBeVisible();

  // el contador de ids de dnd-kit solo se descuadra a partir del segundo render en el servidor
  for (const view of ["board", "board", "list", "table"]) {
    await page.goto(`/HIDR/${view}`);
    await expect(page.getByText("Tarjeta").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
  }
  expect(errors).toEqual([]);
});
