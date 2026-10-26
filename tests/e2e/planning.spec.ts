import { expect, test } from "@playwright/test";

test("ciclos, módulos, hitos y roadmap con asignación desde el detalle", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByPlaceholder("Fichaje").fill("Planes");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await page.waitForURL(/\/PLAN\/list/);
  await page.getByRole("button", { name: /Nuevo issue/ }).click();
  await page.getByLabel("Título del nuevo issue").fill("Tarea planificada");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: "Tarea planificada" })).toBeVisible();

  // Empty states first
  await page.goto("/PLAN/roadmap");
  await expect(page.getByText("Aún no hay nada que planificar")).toBeVisible();

  const create = async (path: string, label: string, name: string, dates: Record<string, string>, button: string) => {
    await page.goto(`/PLAN/${path}`);
    await page.getByLabel(label, { exact: true }).fill(name);
    for (const [l, v] of Object.entries(dates)) await page.getByLabel(l, { exact: true }).fill(v);
    await page.getByRole("button", { name: button }).click();
    await expect(page.getByTestId("plan-item").filter({ hasText: name })).toBeVisible();
  };
  await create("cycles", "Nombre de ciclos", "Sprint 1", { Inicio: "2026-11-02", Fin: "2026-11-15" }, "Crear ciclo");
  await create("modules", "Nombre de módulos", "A · Base", { Inicio: "2026-11-01", Objetivo: "2026-12-15" }, "Crear módulo");
  await create("milestones", "Nombre de hitos", "v1.0", { "Fecha objetivo": "2026-12-20" }, "Crear hito");

  // Assign from the issue detail, then complete it
  await page.goto("/PLAN/issues/1");
  for (const [picker, option] of [["Ciclo", "Sprint 1"], ["Hito", "v1.0"], ["Módulos", "A · Base"]] as const) {
    await page.getByRole("complementary", { name: "Propiedades" }).getByRole("button", { name: picker }).click();
    await page.getByRole("option", { name: option }).click();
    await expect(page.getByRole("complementary", { name: "Propiedades" })).toContainText(option);
  }
  await page.getByRole("complementary", { name: "Propiedades" }).getByRole("button", { name: "Estado" }).click();
  await page.getByRole("option", { name: "Done" }).click();
  await expect(page.getByLabel("Actividad")).toContainText("planificación");

  await page.goto("/PLAN/cycles");
  await expect(page.getByTestId("plan-item").first().getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  await page.goto("/PLAN/roadmap");
  await expect(page.getByTestId("roadmap-row")).toHaveCount(3);
  await expect(page.getByRole("img", { name: "Cronograma" })).toContainText("Sprint 1");
});
