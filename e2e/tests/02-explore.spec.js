// Pestaña de exploración: listado SQL con filtros, paginación, vistas y detalle.
const { test, expect } = require("@playwright/test");
const { visiblePanel } = require("./helpers");

test.describe("Explorar películas", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Explorar" }).click();
    await expect(visiblePanel(page).getByTestId("movie-card")).toHaveCount(12);
  });

  test("lista paginada de todas las películas", async ({ page }) => {
    const panel = visiblePanel(page);
    await expect(panel.getByTestId("result-count")).toContainText("Mostrando 1–12 de 4.799");
    await expect(panel.getByText("Página 1 de 400")).toBeVisible();

    const firstTitle = await panel.getByTestId("movie-card").first().locator("h3").innerText();
    await panel.getByRole("button", { name: "Siguiente" }).click();
    await expect(panel.getByText("Página 2 de 400")).toBeVisible();
    await expect(panel.getByTestId("movie-card").first().locator("h3")).not.toHaveText(firstTitle);
  });

  test("filtra por género y rango de años, y ordena por puntuación", async ({ page }) => {
    const panel = visiblePanel(page);
    await panel.getByLabel("Género").selectOption("Science Fiction");
    await panel.getByLabel("Desde").selectOption("2000");
    await panel.getByLabel("Hasta").selectOption("2010");
    await panel.getByLabel("Ordenar por").selectOption("vote_average");
    await panel.getByLabel("Dirección").selectOption("desc");
    await panel.getByRole("button", { name: "Aplicar filtros" }).click();

    const cards = panel.getByTestId("movie-card");
    await expect(panel.getByTestId("result-count")).not.toContainText("4.799");
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i).locator(".tags")).toContainText("Science Fiction");
      const year = Number(await cards.nth(i).locator(".movieHeading > span").innerText());
      expect(year).toBeGreaterThanOrEqual(2000);
      expect(year).toBeLessThanOrEqual(2010);
    }
    const votes = (await cards.locator(".movieMeta > span:first-child").allInnerTexts())
      .map((text) => Number(text.replace("★", "").trim()))
      .filter((value) => !Number.isNaN(value));
    expect(votes.length).toBeGreaterThan(0);
    expect([...votes].sort((x, y) => y - x)).toEqual(votes);

    await panel.getByRole("button", { name: "Limpiar" }).click();
    await expect(panel.getByTestId("result-count")).toContainText("4.799");
  });

  test("búsqueda por texto sin resultados muestra el estado vacío", async ({ page }) => {
    const panel = visiblePanel(page);
    await panel.getByLabel("Buscar").fill("zzzz-pelicula-que-no-existe");
    await panel.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(panel.getByText("No se encontraron películas con esos filtros.")).toBeVisible();
  });

  test("vista de tabla y detalle de una película", async ({ page }) => {
    const panel = visiblePanel(page);
    await panel.getByRole("button", { name: "Tabla" }).click();
    const rows = panel.getByTestId("movie-table").locator("tbody tr");
    await expect(rows).toHaveCount(12);

    const title = await rows.first().locator(".titleCell").innerText();
    await rows.first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("h2")).toContainText(title);
    await expect(dialog.getByText("Puntuación")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
