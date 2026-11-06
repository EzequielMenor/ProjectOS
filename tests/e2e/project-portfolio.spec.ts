// UNEXECUTED: no Playwright/Next startup was attempted when this file was written (browser proof is pending).
import { expect, test, type Page } from "@playwright/test";

// The database is shared by the whole E2E run, so every query below searches for the "Portf" prefix.
const NAMES = { PFA: "Portf Alfa", PFB: "Portf Beta", PFG: "Portf Gamma" } as const;

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const rows = (page: Page) => page.getByTestId("project-row");
const row = (page: Page, name: string) => rows(page).filter({ has: page.getByRole("link", { name, exact: true }) });

// SSR values and disabled buttons alone do not prove React has attached the form handlers.
async function waitForSettingsHydration(page: Page) {
  const name = page.getByLabel("Nombre del proyecto");
  const save = page.getByRole("button", { name: "Guardar" });
  let attempt = 0;
  await expect.poll(async () => {
    await name.fill(`Portf Alfa hydration probe ${attempt++ % 2}`);
    return save.isEnabled();
  }).toBe(true);
  await name.fill("Portf Alfa");
  await expect(save).toBeDisabled();
}

async function createProject(page: Page, name: string, identifier: string) {
  await page.goto("/projects/new");
  await page.getByPlaceholder("Fichaje").fill(name);
  await page.getByLabel("Identificador").fill(identifier);
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await page.waitForURL(new RegExp(`/${identifier}/list`));
}

test("proyectos: cartera con búsqueda, filtros independientes y cambio de estado", async ({ page }) => {
  for (const [identifier, name] of Object.entries(NAMES)) await createProject(page, name, identifier);

  // settings: lifecycle control is separate from the metadata form and starts at "Planificado" for new projects
  await page.goto("/PFA/settings");
  const lifecycle = page.getByRole("region", { name: "Ciclo de vida del proyecto" });
  const select = lifecycle.getByLabel("Estado de Portf Alfa");
  await expect(select).toHaveValue("planned");
  await waitForSettingsHydration(page);
  await page.getByLabel("Descripción del proyecto").fill("Objetivo: ordenar la cartera");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Proyecto guardado")).toBeVisible();

  await select.selectOption({ label: "En marcha" });
  await expect(page.getByText("Portf Alfa: En marcha")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Ciclo de vida del proyecto" }).getByLabel("Estado de Portf Alfa")).toHaveValue("active");
  // changing the lifecycle neither dirties the metadata form nor overwrites it
  await expect(page.getByRole("button", { name: "Guardar" })).toBeDisabled();
  await expect(page.getByLabel("Nombre del proyecto")).toHaveValue("Portf Alfa");
  await expect(page.getByLabel("Descripción del proyecto")).toHaveValue("Objetivo: ordenar la cartera");
  // saving metadata keeps the lifecycle
  await waitForSettingsHydration(page);
  await page.getByLabel("Descripción del proyecto").fill("Objetivo: ordenar toda la cartera");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Proyecto guardado")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Estado de Portf Alfa")).toHaveValue("active");
  await expect(page.getByLabel("Descripción del proyecto")).toHaveValue("Objetivo: ordenar toda la cartera");

  // overview: navigation entry, heading, create link, and the default view of new (planned) projects
  await page.goto("/PFA/list");
  await page.getByRole("complementary", { name: "Navegación" }).getByRole("link", { name: "Todos los proyectos" }).click();
  await page.waitForURL(/\/projects$/);
  await expect(page.getByRole("heading", { name: "Proyectos", level: 1 })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Nuevo proyecto" })).toHaveAttribute("href", "/projects/new");
  await page.goto("/projects?q=portf");
  await expect(rows(page)).toHaveCount(3);
  await expect(row(page, "Portf Alfa")).toContainText("Objetivo: ordenar toda la cartera");
  await expect(row(page, "Portf Alfa")).toContainText("PFA");
  await expect(row(page, "Portf Beta")).toContainText("Sin objetivo definido.");
  await expect(row(page, "Portf Beta").getByLabel("Estado de Portf Beta")).toHaveValue("planned");
  await expect(row(page, "Portf Alfa").getByLabel("Estado de Portf Alfa")).toHaveValue("active");

  // changing a row's state uses the same action and leaves name and description alone
  await row(page, "Portf Beta").getByLabel("Estado de Portf Beta").selectOption({ label: "Terminado" });
  await expect(page.getByText("Portf Beta: Terminado")).toBeVisible();
  // finished projects leave the default tracking view but stay one filter away
  await expect(rows(page)).toHaveCount(2);
  await expect(row(page, "Portf Beta")).toHaveCount(0);
  await page.goto("/projects?q=portf&status=completed");
  await expect(rows(page)).toHaveCount(1);
  await expect(row(page, "Portf Beta").getByLabel("Estado de Portf Beta")).toHaveValue("completed");
  await page.goto("/PFB/settings");
  await expect(page.getByLabel("Estado de Portf Beta")).toHaveValue("completed");
  await expect(page.getByLabel("Nombre del proyecto")).toHaveValue("Portf Beta");

  // the lifecycle can go back to unclassified, and that is a filter of its own
  await page.goto("/projects?q=portf&status=completed");
  await row(page, "Portf Beta").getByLabel("Estado de Portf Beta").selectOption({ label: "Sin clasificar" });
  await expect(page.getByText("Portf Beta: Sin clasificar")).toBeVisible();
  await page.goto("/projects?q=portf&status=unclassified");
  await expect(rows(page)).toHaveCount(1);
  await expect(row(page, "Portf Beta")).toBeVisible();
  await page.goto("/projects?q=portf");
  await expect(rows(page)).toHaveCount(3); // unclassified projects are part of the tracked view

  // archived is independent of the lifecycle: nothing is archived here and no archive controls exist yet
  await page.goto("/projects?q=portf&view=archived");
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByText("Ningún proyecto coincide con estos filtros.")).toBeVisible();
  await page.goto("/projects?q=portf&view=all");
  await expect(rows(page)).toHaveCount(3);
  await expect(page.getByText("Archivado", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /archivar/i })).toHaveCount(0);

  // search: by name, identifier and objective, ignoring case and accents; no match offers a reset
  await page.goto("/projects?q=PORTF%20ALFA");
  await expect(rows(page)).toHaveCount(1);
  await page.goto("/projects?q=pfg");
  await expect(row(page, "Portf Gamma")).toBeVisible();
  await page.goto("/projects?q=ORDENAR%20cartera");
  await expect(rows(page)).toHaveCount(1);
  await expect(row(page, "Portf Alfa")).toBeVisible();
  await page.goto("/projects?q=nada-coincide-con-esto");
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByText("Ningún proyecto coincide con estos filtros.")).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Limpiar filtros" }).first().click();
  await expect(page).toHaveURL(/\/projects$/);

  // keyboard: the search is a native GET form whose result lives in the URL
  const search = page.getByRole("searchbox", { name: "Buscar" });
  await search.fill("portf gamma");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/projects\?q=portf\+gamma&status=all&view=tracked$/);
  await expect(rows(page)).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("searchbox", { name: "Buscar" })).toHaveValue("portf gamma");

  // each row opens the project; unknown and repeated params fall back safely
  await row(page, "Portf Gamma").getByRole("link", { name: "Portf Gamma", exact: true }).click();
  await page.waitForURL(/\/PFG\/list/);
  await page.goto("/projects?status=nope&status=completed&view=nope&view=all&q=portf&q=otro&x=1");
  await expect(page.getByRole("heading", { name: "Proyectos", level: 1 })).toBeVisible();
  // the first repeated value wins: an invalid status or view falls back to the defaults instead of using the later value
  await expect(row(page, "Portf Alfa")).toBeVisible();
  await expect(page.getByRole("search").locator('select[name="status"]')).toHaveValue("all");
  await expect(page.getByLabel("Mostrar")).toHaveValue("tracked");
});

test("proyectos: la cartera cabe en móvil y el menú lleva a ella", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createProject(page, "Portf Movil con un nombre bastante largo para comprobar que se ajusta", "PFM");
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("dialog", { name: "Navegación" }).getByRole("link", { name: "Todos los proyectos" }).click();
  await page.waitForURL(/\/projects$/);
  await expect(page.getByRole("dialog", { name: "Navegación" })).toHaveCount(0);
  await page.goto("/projects?q=portf%20movil");
  await expect(rows(page)).toHaveCount(1);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});
