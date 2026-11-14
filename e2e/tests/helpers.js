const API_URL = process.env.E2E_API_URL || "http://localhost:3001/api";

// La pestaña activa es la única visible; las dos vistas quedan montadas.
const visiblePanel = (page) => page.locator(".panel > div:not([hidden])");

module.exports = { API_URL, visiblePanel };
