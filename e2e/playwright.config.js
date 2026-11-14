// Pruebas end-to-end: se ejecutan contra el stack completo levantado con
// `docker compose up --build` (frontend, backend, embedder, Postgres/pgvector y Gemini).
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 120_000, // el chat llama al embedder y a Gemini; la primera consulta puede tardar
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    locale: "es-UY",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
