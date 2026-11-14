// Verifica que todos los servicios estén conectados antes de probar la interfaz.
const { test, expect } = require("@playwright/test");
const { API_URL } = require("./helpers");

test.describe("API del backend", () => {
  test("health: base conectada, pgvector habilitado y películas con embedding", async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    expect(response.ok()).toBeTruthy();
    const health = await response.json();
    expect(health.database.status).toBe("connected");
    expect(health.pgvector.enabled).toBe(true);
    expect(health.database.movieCount).toBeGreaterThan(4000);
    expect(health.database.embeddingCount).toBe(health.database.movieCount);
    expect(health.services.geminiConfigured).toBe(true);
  });

  test("chat RAG: devuelve respuesta y top K ordenado por similitud", async ({ request }) => {
    const response = await request.post(`${API_URL}/chat`, {
      data: { message: "An emotional space adventure about time and family", topK: 5 },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.answer.trim().length).toBeGreaterThan(20);
    expect(body.movies).toHaveLength(5);
    const similarities = body.movies.map((movie) => movie.similarity);
    expect([...similarities].sort((a, b) => b - a)).toEqual(similarities);
    for (const value of similarities) {
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  test("errores de validación devuelven 400", async ({ request }) => {
    const empty = await request.post(`${API_URL}/chat`, { data: { message: "   " } });
    expect(empty.status()).toBe(400);
    expect((await empty.json()).error.code).toBe("INVALID_MESSAGE");

    const tooManyMovies = await request.post(`${API_URL}/chat`, { data: { message: "comedia", topK: 500 } });
    expect(tooManyMovies.status()).toBe(400);

    const badLimit = await request.get(`${API_URL}/movies?limit=500`);
    expect(badLimit.status()).toBe(400);

    const badYears = await request.get(`${API_URL}/movies?yearFrom=2010&yearTo=2000`);
    expect(badYears.status()).toBe(400);
  });
});
