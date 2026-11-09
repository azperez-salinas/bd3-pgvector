function positiveInteger(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

const config = {
  port: positiveInteger("PORT", 3001),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  postgres: {
    host: process.env.PGHOST || "localhost",
    port: positiveInteger("PGPORT", 5432),
    database: process.env.PGDATABASE || "app_db",
    user: process.env.PGUSER || "app_user",
    password: process.env.PGPASSWORD || "app_password",
    maxConnections: positiveInteger("PGPOOL_MAX", 10),
    connectionTimeoutMs: positiveInteger("PG_CONNECTION_TIMEOUT_MS", 5000),
  },
  embedder: {
    baseUrl: (process.env.EMBEDDER_URL || "http://localhost:8000").replace(/\/$/, ""),
    timeoutMs: positiveInteger("EMBEDDER_TIMEOUT_MS", 30000),
    dimensions: 768,
  },
  gemini: {
    apiUrlBase: "https://generativelanguage.googleapis.com/v1beta/models",
    apiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    timeoutMs: positiveInteger("GEMINI_TIMEOUT_MS", 60000),
    temperature: Number(process.env.GEMINI_TEMPERATURE || 0.2),
  },
  rag: {
    topK: positiveInteger("RAG_TOP_K", 5),
    maxTopK: positiveInteger("RAG_MAX_TOP_K", 20),
  },
};

if (
  !Number.isFinite(config.gemini.temperature) ||
  config.gemini.temperature < 0 ||
  config.gemini.temperature > 2
) {
  throw new Error("GEMINI_TEMPERATURE must be a number between 0 and 2");
}

module.exports = { config };
