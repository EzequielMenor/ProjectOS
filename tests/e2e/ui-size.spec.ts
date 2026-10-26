import { expect, test } from "@playwright/test";

const rootSize = (page: import("@playwright/test").Page) => page.evaluate(() => getComputedStyle(document.documentElement).fontSize);

test("el tamaño de la interfaz se cambia, se recuerda y se restablece", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 300)));

  await page.goto("/projects/new");
  expect(await rootSize(page)).toBe("18px"); // default
  const group = page.getByRole("group", { name: "Tamaño de la interfaz" });

  await group.getByRole("button", { name: "Aumentar tamaño de la interfaz" }).click();
  expect(await rootSize(page)).toBe("20px");
  await expect(group).toContainText("125%");

  // the server renders the saved size on the next load
  await page.reload();
  expect(await rootSize(page)).toBe("20px");
  await expect(group).toContainText("125%");

  for (let i = 0; i < 2; i++) await group.getByRole("button", { name: "Aumentar tamaño de la interfaz" }).click();
  expect(await rootSize(page)).toBe("24px");
  await expect(group.getByRole("button", { name: "Aumentar tamaño de la interfaz" })).toBeDisabled();

  await group.getByRole("button", { name: "Restablecer tamaño de la interfaz" }).click();
  expect(await rootSize(page)).toBe("18px");
  for (let i = 0; i < 2; i++) await group.getByRole("button", { name: "Reducir tamaño de la interfaz" }).click();
  expect(await rootSize(page)).toBe("14px");
  await expect(group.getByRole("button", { name: "Reducir tamaño de la interfaz" })).toBeDisabled();

  await page.reload();
  expect(await rootSize(page)).toBe("14px");
  expect(errors).toEqual([]);
});
