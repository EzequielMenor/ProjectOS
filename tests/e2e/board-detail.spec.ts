import { expect, test, type Page } from "@playwright/test";

async function seed(page: Page, name: string, titles: string[]) {
  await page.goto("/projects/new");
  await page.getByPlaceholder("Fichaje").fill(name);
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await page.waitForURL(/\/list/);
  for (const t of titles) {
    await page.getByRole("button", { name: /Nuevo issue/ }).click();
    await page.getByLabel("Título del nuevo issue").fill(t);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("issue-row").filter({ hasText: t })).not.toContainText("pending");
    await expect(page.getByRole("link", { name: t })).toBeVisible();
  }
}

test("arrastrar una tarjeta entre columnas persiste", async ({ page }) => {
  await seed(page, "Drag Test", ["Mover esta"]);
  await page.goto("/DRAG/board");
  const card = page.getByRole("region", { name: "Todo" }).getByTestId("issue-card");
  await expect(card).toContainText("Mover esta");
  const target = page.getByRole("region", { name: "In Progress" });
  const a = (await card.boundingBox())!;
  const b = (await target.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2 + 20, { steps: 5 });
  await page.mouse.move(b.x + b.width / 2, b.y + 120, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByRole("region", { name: "In Progress" }).getByTestId("issue-card")).toContainText("Mover esta");
  await page.reload();
  await expect(page.getByRole("region", { name: "In Progress" }).getByTestId("issue-card")).toContainText("Mover esta");
  await expect(page.getByRole("region", { name: "Todo" }).getByTestId("issue-card")).toHaveCount(0);
});

test("detalle: editar título, descripción y comentar", async ({ page }) => {
  await seed(page, "Detail Test", ["Original"]);
  await page.getByRole("link", { name: "Original" }).click();
  await page.waitForURL(/\/DETA\/issues\/1/);
  await page.getByLabel("Título").fill("Título nuevo");
  await page.getByLabel("Descripción").fill("Descripción **real**");
  await page.getByLabel("Nuevo comentario").fill("Primer comentario");
  await page.getByRole("button", { name: "Comentar" }).click();
  await expect(page.getByLabel("Nuevo comentario")).toHaveValue(""); // cleared only after the server accepted it
  await expect(page.getByLabel("Actividad").getByText("Primer comentario")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Título")).toHaveValue("Título nuevo");
  await expect(page.getByLabel("Descripción")).toHaveValue("Descripción **real**");
  await expect(page.getByLabel("Actividad")).toContainText("Primer comentario");
});
