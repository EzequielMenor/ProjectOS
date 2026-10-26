import { expect, test } from "@playwright/test";

test("docs: páginas Markdown con enlaces bidireccionales, historial y búsqueda", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByPlaceholder("Fichaje").fill("Documentos");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await page.waitForURL(/\/DOCU\/list/);
  await page.getByRole("button", { name: /Nuevo issue/ }).click();
  await page.getByLabel("Título del nuevo issue").fill("Terminal de fichaje");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: "Terminal de fichaje" })).toBeVisible();

  await page.goto("/DOCU/pages");
  await expect(page.getByText("Aún no hay páginas")).toBeVisible();

  // first page links forward to a page that does not exist yet
  await page.getByLabel("Título de la nueva página").fill("Diseño");
  await page.getByRole("button", { name: "Crear página" }).click();
  await page.waitForURL(/\/DOCU\/pages\/[0-9a-f-]{36}/);
  await page.getByLabel("Contenido (Markdown)").fill("# Diseño\n\nDepende de DOCU-1 y de [[Arquitectura]].\n\n- **punto** uno");
  await page.getByRole("button", { name: "Vista previa" }).click();
  const preview = page.getByTestId("page-preview");
  await expect(preview.getByRole("heading", { name: "Diseño" })).toBeVisible();
  await expect(preview.getByRole("link", { name: "DOCU-1" })).toHaveAttribute("href", "/DOCU/issues/1");
  await expect(preview.getByText("Arquitectura")).toBeVisible(); // unresolved, marked as such
  await expect(preview.getByRole("link", { name: "Arquitectura" })).toHaveCount(0);
  await expect(page.getByText("Guardado")).toBeVisible();

  // creating the target resolves the earlier link in both directions
  await page.goto("/DOCU/pages");
  await page.getByLabel("Título de la nueva página").fill("Arquitectura");
  await page.getByRole("button", { name: "Crear página" }).click();
  await page.waitForURL(/\/DOCU\/pages\/[0-9a-f-]{36}/);
  await page.getByLabel("Contenido (Markdown)").fill("Un monolito en Next.js.");
  await page.getByRole("button", { name: "Vista previa" }).click();
  await expect(page.getByLabel("Enlaces", { exact: true })).toContainText("Enlazada desde");
  await expect(page.getByRole("region", { name: "Enlaces" }).getByRole("link", { name: "Diseño" })).toBeVisible();

  // the issue lists the page that mentions it
  await page.goto("/DOCU/issues/1");
  await expect(page.getByRole("region", { name: "Mencionado en" }).getByRole("link", { name: "Diseño" })).toBeVisible();
  await page.getByRole("region", { name: "Mencionado en" }).getByRole("link", { name: "Diseño" }).click();
  await page.waitForURL(/\/DOCU\/pages\//);
  await expect(page.getByTestId("page-preview").getByRole("link", { name: "Arquitectura" })).toBeVisible();

  // edit twice → history keeps the old text, and restoring brings it back
  await page.getByRole("button", { name: "Editar" }).click();
  await page.getByLabel("Contenido (Markdown)").fill("Texto reescrito");
  await page.getByLabel("Título de la página").click(); // blur saves
  await expect(page.getByText("Guardado")).toBeVisible();
  await page.reload();
  const history = page.getByRole("region", { name: "Historial" });
  await expect(history.getByRole("button", { name: "Restaurar" })).toHaveCount(2);
  // restoring reloads the document; wait for it so later keystrokes do not land on the page being replaced
  const reloaded = page.waitForEvent("load");
  await history.getByRole("button", { name: "Restaurar" }).first().click();
  await reloaded;
  await expect(page.getByTestId("page-preview")).toContainText("Depende de");

  // palette finds the page
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Paleta de comandos" });
  await palette.getByRole("combobox").fill("monolito");
  await expect(palette.getByRole("option", { name: /Arquitectura/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/DOCU\/pages\//);
  await expect(page.getByLabel("Título de la página")).toHaveValue("Arquitectura");

  // archived pages leave the list
  await page.getByRole("button", { name: "Archivar" }).click();
  await page.waitForURL(/\/DOCU\/pages$/);
  await expect(page.getByTestId("page-row")).toHaveCount(1);
});
