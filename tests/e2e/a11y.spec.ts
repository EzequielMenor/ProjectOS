import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Contrast and structure checks (WCAG 2.1 A/AA) in both themes, on the screens people actually use.
async function audit(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(
    violations.map((v) => `${where}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`),
  ).toEqual([]);
}

for (const theme of ["light", "dark"] as const) {
  test(`accesibilidad y contraste en tema ${theme}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme);

    await page.goto("/projects/new");
    await audit(page, "nuevo proyecto");
    await page.getByPlaceholder("Fichaje").fill(`Acc ${theme}`);
    await page.getByRole("button", { name: "Crear proyecto" }).click();
    await page.waitForURL(/\/list/);
    const key = new URL(page.url()).pathname.split("/")[1];

    // some data, so cards, badges and progress bars are audited too
    await page.getByRole("button", { name: /Nuevo issue/ }).click();
    await page.getByLabel("Título del nuevo issue").fill("Épica de prueba");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: "Épica de prueba" })).toBeVisible();
    await page.getByRole("button", { name: /Nuevo issue/ }).click();
    await page.getByLabel("Título del nuevo issue").fill("Tarea hija");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: "Tarea hija" })).toBeVisible();

    // custom properties, so settings, detail and table are audited with them present
    await page.goto(`/${key}/settings`);
    const props = page.getByRole("region", { name: "Propiedades personalizadas" });
    for (const [name, type, options] of [["Severidad", "select", "Alta, Baja"], ["Horas", "number", ""]]) {
      await props.getByLabel("Nombre de la nueva propiedad").fill(name);
      await props.getByLabel("Tipo de la nueva propiedad").selectOption(type);
      if (options) await props.getByLabel("Opciones de la nueva propiedad").fill(options);
      await props.getByRole("button", { name: "Añadir" }).click();
      await expect(props.getByLabel(`Nombre de ${name}`)).toBeVisible();
    }
    await page.goto(`/${key}/issues/1`);
    await page.getByRole("complementary", { name: "Propiedades" }).getByLabel("Horas").fill("8");
    await page.getByRole("complementary", { name: "Propiedades" }).getByLabel("Horas").press("Enter");
    await expect(page.getByText("cambió «Horas»")).toBeVisible();

    // members: one person and one agent, each holding an issue, so avatars are audited on rows, cards and the table
    await page.goto("/settings/members");
    const members = page.getByRole("region", { name: "Miembros" });
    for (const [name, kind] of [[`Persona ${theme}`, "human"], [`Agente ${theme}`, "agent"]]) {
      await members.getByLabel("Nombre del nuevo miembro").fill(name);
      await members.getByLabel("Tipo del nuevo miembro").selectOption(kind);
      await members.getByRole("button", { name: "Añadir" }).click();
      await expect(members.getByLabel(`Nombre de ${name}`)).toBeVisible();
    }
    for (const [n, name] of [[1, `Agente ${theme}`], [2, `Persona ${theme}`]] as const) {
      await page.goto(`/${key}/issues/${n}`);
      await page.getByRole("complementary", { name: "Propiedades" }).getByRole("button", { name: "Asignado" }).click();
      await page.getByRole("option", { name, exact: true }).click();
      await expect(page.getByRole("complementary", { name: "Propiedades" }).getByRole("button", { name: "Asignado" })).toContainText(name);
    }

    // a saved view, so the sidebar entry is audited too
    await page.goto(`/${key}/list`);
    await page.getByRole("button", { name: "Vistas guardadas" }).click();
    await page.getByLabel("Nombre de la vista").fill("Todo el proyecto");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByRole("group", { name: "Vistas guardadas" }).getByRole("link", { name: "Todo el proyecto" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-slot=popover-content]")).toHaveCount(0);

    for (const path of ["list", "board", "table", "epics", "cycles", "modules", "milestones", "roadmap", "pages", "settings", "issues/1", "issues/2"]) {
      await page.goto(`/${key}/${path}`);
      await page.waitForLoadState("networkidle");
      await audit(page, path);
    }
    for (const path of ["/settings/members", "/settings/tokens", "/settings/backup"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await audit(page, path);
    }

    // overlays: command palette and a filter dropdown
    await page.goto(`/${key}/list`);
    await page.getByRole("button", { name: /Buscar/ }).first().click();
    await expect(page.getByRole("dialog", { name: "Paleta de comandos" })).toBeVisible();
    await audit(page, "paleta");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Estado" }).first().click(); // the filter bar comes before the rows' own state pickers
    await expect(page.locator("[data-slot=popover-content]")).toBeVisible();
    await audit(page, "filtro de estado");
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-slot=popover-content]")).toHaveCount(0); // exit animation done
    await page.getByRole("button", { name: "Filtrar por asignado" }).click();
    await expect(page.locator("[data-slot=popover-content]")).toBeVisible();
    await audit(page, "filtro de asignado");

    // 404 inside the app shell
    await page.goto(`/${key}/issues/999`);
    await expect(page.getByRole("heading", { name: "No se ha encontrado" })).toBeVisible();
    await audit(page, "404");

    // the loading skeletons must not turn a missing thing into HTTP 200
    for (const missing of [`/${key}/issues/999`, `/${key}/pages/00000000-0000-0000-0000-000000000000`, `/${key}/nope`, "/NOEXISTE/epics", "/NOEXISTE/board"]) {
      expect((await page.request.get(missing)).status(), missing).toBe(404);
    }
  });
}

test("teclado: enlace para saltar al contenido y foco visible en los selectores", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByPlaceholder("Fichaje").fill("Teclado");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await page.waitForURL(/\/TECL\/list/);
  await page.getByRole("button", { name: /Nuevo issue/ }).click();
  await page.getByLabel("Título del nuevo issue").fill("Con foco");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: "Con foco" })).toBeVisible();

  // first Tab lands on the skip link, which is only visible while focused, and it moves focus into <main>
  await page.goto("/TECL/list");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Saltar al contenido" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();

  // property pickers draw a ring when reached with the keyboard (a background tint alone was nearly invisible)
  await page.goto("/TECL/issues/1");
  await page.getByRole("button", { name: "Prioridad" }).focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Prioridad" })).toBeFocused();
  const ring = await page.getByRole("button", { name: "Prioridad" }).evaluate((e) => getComputedStyle(e).boxShadow);
  expect(ring).not.toBe("none");
});
