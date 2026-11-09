const { AppError } = require("../errors");
const { fetchJson } = require("./http");

async function createEmbedding(text, config) {
  const body = await fetchJson(
    `${config.baseUrl}/embed`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, kind: "query" }),
    },
    { timeoutMs: config.timeoutMs, service: "EMBEDDER" }
  );

  const embedding = body?.embedding;
  if (
    !Array.isArray(embedding) ||
    embedding.length !== config.dimensions ||
    embedding.some((value) => typeof value !== "number" || !Number.isFinite(value))
  ) {
    throw new AppError(502, "EMBEDDER_INVALID_VECTOR", "Embedder returned an invalid vector");
  }

  return embedding;
}

module.exports = { createEmbedding };
