import fs from "node:fs";
import { expect, test } from "@playwright/test";

test("copia de seguridad: descargar, modificar, simular y restaurar", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByPlaceholder("Fichaje").fill("Respaldo");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await page.waitForURL(/\/RESP\/list/);
  await page.getByRole("button", { name: /Nuevo issue/ }).click();
  await page.getByLabel("Título del nuevo issue").fill("Dato a conservar");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: "Dato a conservar" })).toBeVisible();

  await page.goto("/settings/backup");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Descargar copia" }).click()]);
  const file = test.info().outputPath("copia.json");
  await download.saveAs(file);
  const backup = JSON.parse(fs.readFileSync(file, "utf8"));
  expect(backup.format).toBe("projectos-backup");
  expect(backup.counts.issue).toBeGreaterThanOrEqual(1);

  // Change data after the backup
  await page.goto("/projects/new");
  await page.getByPlaceholder("Fichaje").fill("Posterior");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await page.waitForURL(/\/POST\/list/);

  await page.goto("/settings/backup");
  await page.getByLabel("Archivo de copia").setInputFiles(file);
  await page.getByRole("button", { name: "Simular" }).click();
  await expect(page.getByRole("status").first()).toContainText("issues");
  const restore = page.getByRole("button", { name: "Restaurar", exact: true });
  await expect(restore).toBeDisabled();
  await page.getByLabel("Confirmación").fill("RESTAURAR");
  await restore.click();
  await expect(page.getByText(/Restaurado:/)).toBeVisible();

  // Post-backup project is gone, the original data is back
  await page.goto("/RESP/list");
  await expect(page.getByRole("link", { name: "Dato a conservar" })).toBeVisible();
  expect((await page.request.get("/POST/list")).status()).toBe(404);

  // The browser cannot be tricked cross-site: no confirm header -> refused
  const forged = await page.request.post("/api/backup?replace=1", { data: backup, headers: { origin: "http://evil.example" } });
  expect(forged.status()).toBe(403);
});
