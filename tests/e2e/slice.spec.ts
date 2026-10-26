import { expect, test } from "@playwright/test";

test("crear proyecto, issue, cambiar estado, lista y Kanban, persistencia", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByPlaceholder("Fichaje").fill("Demo E2E");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await page.waitForURL(/\/DEMO\/list/);

  // Quick create in the list view
  await page.getByRole("button", { name: /Nuevo issue/ }).click();
  await page.getByLabel("Título del nuevo issue").fill("Primer issue real");
  await page.keyboard.press("Enter");
  const row = page.getByTestId("issue-row").filter({ hasText: "Primer issue real" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("DEMO-1");

  // Change state through the picker
  await row.getByRole("button", { name: "Estado" }).click();
  await page.getByRole("option", { name: "In Progress" }).click();
  await expect(page.getByRole("region", { name: "In Progress" }).getByText("Primer issue real")).toBeVisible();

  // Kanban shows it in the right column
  await page.getByRole("navigation", { name: "Vista" }).getByRole("link", { name: "Kanban" }).click();
  await page.waitForURL(/\/DEMO\/board/);
  await expect(page.getByRole("region", { name: "In Progress" }).getByTestId("issue-card")).toContainText("Primer issue real");

  // Persists across reload (server round-trip)
  await page.reload();
  await expect(page.getByRole("region", { name: "In Progress" }).getByTestId("issue-card")).toContainText("Primer issue real");
});
