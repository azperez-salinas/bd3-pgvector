const { AppError } = require("../errors");
const { fetchJson } = require("./http");

function movieContext(movies) {
  return movies
    .map((movie, index) => {
      const fields = [
        `${index + 1}. ${movie.title}${movie.release_year ? ` (${movie.release_year})` : ""}`,
        `Géneros: ${(movie.genres || []).join(", ") || "sin datos"}`,
        movie.tagline ? `Tagline: ${movie.tagline}` : null,
        `Sinopsis: ${movie.overview}`,
        movie.vote_average !== null ? `Puntuación: ${movie.vote_average}` : null,
        `Similitud semántica: ${Number(movie.similarity).toFixed(3)}`,
      ];
      return fields.filter(Boolean).join("\n");
    })
    .join("\n\n");
}

async function recommendWithGemini(userMessage, movies, config) {
  if (!config.apiKey || !config.model) {
    throw new AppError(
      503,
      "GEMINI_NOT_CONFIGURED",
      "GEMINI_API_KEY and GEMINI_MODEL must be configured to use the chat endpoint"
    );
  }

  const encodedModel = encodeURIComponent(config.model);
  const body = await fetchJson(
    `${config.apiUrlBase}/${encodedModel}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                "Eres un recomendador de películas. Responde en español y usa exclusivamente las películas del contexto. " +
                "Explica brevemente por qué encajan con la descripción. No inventes datos ni menciones películas externas.",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Descripción del usuario:\n${userMessage}\n\nPelículas recuperadas de la base de datos:\n${movieContext(movies)}`,
              },
            ],
          },
        ],
        generationConfig: { temperature: config.temperature },
      }),
    },
    { timeoutMs: config.timeoutMs, service: "GEMINI" }
  );

  const answer = body?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter((text) => typeof text === "string")
    .join("")
    .trim();
  if (!answer) {
    const finishReason = body?.candidates?.[0]?.finishReason;
    throw new AppError(
      502,
      "GEMINI_INVALID_RESPONSE",
      "Gemini returned an empty response",
      finishReason ? { finishReason } : undefined
    );
  }
  return answer;
}

module.exports = { recommendWithGemini };
