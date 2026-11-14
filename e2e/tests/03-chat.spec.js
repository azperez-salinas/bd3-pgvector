// Chat RAG de punta a punta: frontend -> backend -> embedder -> pgvector -> Gemini.
const { test, expect } = require("@playwright/test");
const { visiblePanel } = require("./helpers");

async function ask(page, text) {
  const panel = visiblePanel(page);
  await panel.getByLabel("Describí la película que buscás").fill(text);
  await panel.getByRole("button", { name: "Enviar" }).click();
}

test.describe("Chat de recomendaciones", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.getByTestId("health")).toContainText("películas con embedding");
  });

  test("recomienda películas con respuesta generada y tarjetas con similitud", async ({ page }) => {
    const panel = visiblePanel(page);
    await panel.getByLabel("Cantidad de películas para el contexto").selectOption("3");
    await ask(page, "A gangster drama about loyalty in a crime family");

    await expect(panel.getByTestId("user-message")).toHaveText("A gangster drama about loyalty in a crime family");
    await expect(panel.getByTestId("chat-loading")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Buscando…" })).toBeDisabled();

    const answer = panel.getByTestId("chat-answer");
    await expect(answer).toBeVisible({ timeout: 90_000 });
    expect((await answer.innerText()).trim().length).toBeGreaterThan(20);

    const cards = panel.getByTestId("movie-card");
    await expect(cards).toHaveCount(3);
    await expect(cards.first().locator(".rank")).toHaveText("#1");
    await expect(cards.first().locator(".similarity")).toContainText("%");
  });

  test("mantiene el historial de la conversación y se puede reiniciar", async ({ page }) => {
    const panel = visiblePanel(page);
    await ask(page, "A light family comedy for a sunday afternoon");
    await expect(panel.getByTestId("chat-answer")).toHaveCount(1, { timeout: 90_000 });

    await panel.getByLabel("Describí la película que buscás").fill("A psychological thriller with a twist ending");
    await panel.getByLabel("Describí la película que buscás").press("Enter");
    await expect(panel.getByTestId("chat-answer")).toHaveCount(2, { timeout: 90_000 });
    await expect(panel.getByTestId("user-message")).toHaveCount(2);

    // El historial sobrevive a recargar la página.
    await page.reload();
    await expect(visiblePanel(page).getByTestId("user-message")).toHaveCount(2);

    await visiblePanel(page).getByRole("button", { name: "Nueva conversación" }).click();
    await expect(visiblePanel(page).getByTestId("user-message")).toHaveCount(0);
    await expect(visiblePanel(page).getByText("¿Qué querés ver hoy?")).toBeVisible();
  });

  test("abre el detalle de una película recomendada", async ({ page }) => {
    const panel = visiblePanel(page);
    await ask(page, "Space exploration and astronauts far from home");
    await expect(panel.getByTestId("chat-answer")).toBeVisible({ timeout: 90_000 });

    const title = await panel.getByTestId("movie-card").first().locator("h3").innerText();
    await panel.getByTestId("movie-card").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Similitud con tu descripción")).toBeVisible();
    expect(title).toContain(await dialog.locator("h2").evaluate((h) => h.childNodes[0].textContent.trim()));
    await dialog.getByRole("button", { name: "Cerrar" }).click();
    await expect(dialog).toBeHidden();
  });

  test("muestra un error claro si el backend falla y permite reintentar", async ({ page }) => {
    const panel = visiblePanel(page);
    let calls = 0;
    await page.route("**/api/chat", async (route) => {
      calls += 1;
      if (calls === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ status: "error", error: { code: "EMBEDDER_UNAVAILABLE", message: "EMBEDDER is unavailable" } }),
        });
      } else {
        await route.continue();
      }
    });

    await ask(page, "A romantic movie set in Paris");
    await expect(panel.getByTestId("chat-error")).toContainText("servicio de embeddings no está disponible");
    await panel.getByRole("button", { name: "Reintentar" }).click();
    await expect(panel.getByTestId("chat-answer")).toBeVisible({ timeout: 90_000 });
    expect(calls).toBe(2);
  });
});
