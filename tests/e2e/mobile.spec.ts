import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("móvil: menú en cajón, búsqueda, vistas sin desbordar y título que se ajusta", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 300)));

  await page.goto("/projects/new");
  await page.getByPlaceholder("Fichaje").fill("Movil");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await page.waitForURL(/\/MOVI\/list/);

  // the desktop sidebar is hidden; the menu button opens the same navigation as a drawer
  await expect(page.getByRole("complementary", { name: "Navegación" })).toBeHidden();
  await page.getByRole("button", { name: "Nuevo issue" }).click();
  const long = "Un título bastante largo para comprobar que en el móvil se ajusta en varias líneas y no se corta por la derecha";
  await page.getByLabel("Título del nuevo issue").fill(long);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: long })).toBeVisible();

  for (const view of ["list", "board", "table"]) {
    await page.goto(`/MOVI/${view}`);
    await expect(page.getByText(long.slice(0, 20)).first()).toBeVisible();
    expect(await overflow(page), `desborde en ${view}`).toBeLessThanOrEqual(0);
  }

  // drawer: open, navigate with a link, and it closes by itself
  await page.getByRole("button", { name: "Abrir menú" }).click();
  const drawer = page.getByRole("dialog", { name: "Navegación" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("link", { name: "Épicas" }).click();
  await page.waitForURL(/\/MOVI\/epics/);
  await expect(drawer).toBeHidden();

  // it can also be closed explicitly, and the size control is reachable from it
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await expect(drawer.getByRole("group", { name: "Tamaño de la interfaz" })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar menú" }).click();
  await expect(drawer).toBeHidden();

  // search opens from the top bar
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByRole("dialog", { name: "Paleta de comandos" })).toBeVisible();
  await page.keyboard.press("Escape");

  // the detail page wraps a long title instead of cutting it off
  await page.goto("/MOVI/issues/1");
  const title = page.getByLabel("Título");
  await expect(title).toHaveValue(long);
  const box = await title.boundingBox();
  expect(box!.height).toBeGreaterThan(40); // more than one line
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
