import { expect, test } from "@playwright/test";

test("paleta Ctrl+K: buscar por clave y por texto, navegar y atajos g", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByPlaceholder("Fichaje").fill("Buscador");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await page.waitForURL(/\/BUSC\/list/);
  for (const t of ["Exportar informe 100% PDF", "Corregir login", "Documentar API"]) {
    await page.getByRole("button", { name: /Nuevo issue/ }).click();
    await page.getByLabel("Título del nuevo issue").fill(t);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: t })).toBeVisible();
  }

  const palette = page.getByRole("dialog", { name: "Paleta de comandos" });
  await page.keyboard.press("Control+k");
  await expect(palette).toBeVisible();

  // by key
  await palette.getByRole("combobox").fill("BUSC-2");
  await expect(palette.getByRole("option", { name: /Corregir login/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/BUSC\/issues\/2/);
  await expect(page.getByLabel("Título")).toHaveValue("Corregir login");

  // by text; "%" is literal, not a wildcard
  await page.keyboard.press("Control+k");
  await palette.getByRole("combobox").fill("100%");
  await expect(palette.getByRole("option", { name: /Exportar informe/ })).toBeVisible();
  await expect(palette.getByRole("option", { name: /Corregir login/ })).toHaveCount(0);
  await palette.getByRole("combobox").fill("%");
  await expect(palette.getByRole("option", { name: /Exportar informe/ })).toBeVisible();
  await expect(palette.getByRole("option", { name: /Documentar/ })).toHaveCount(0);

  // views of the current project + escape closes
  await palette.getByRole("combobox").fill("kanban");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/BUSC\/board/);
  await expect(palette).toBeHidden();

  // g then c → cycles (outside inputs)
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("g");
  await page.keyboard.press("c");
  await page.waitForURL(/\/BUSC\/cycles/);

  // "/" opens it too; no results is explained
  await page.keyboard.press("/");
  await palette.getByRole("combobox").fill("zzzz-nada");
  await expect(palette.getByText("Sin resultados")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
});
