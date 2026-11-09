require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const { config } = require("./config");
const { AppError, asyncRoute, errorHandler, notFoundHandler } = require("./errors");
const { getMovieFilters, listMovies, searchSimilarMovies, SORT_COLUMNS } = require("./repositories/movies");
const { createEmbedding } = require("./services/embedder");
const { recommendWithGemini } = require("./services/gemini");

const app = express();
app.use(express.json({ limit: "32kb" }));
app.use(cors({ origin: config.corsOrigin }));

const pool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  database: config.postgres.database,
  user: config.postgres.user,
  password: config.postgres.password,
  max: config.postgres.maxConnections,
  connectionTimeoutMillis: config.postgres.connectionTimeoutMs,
  idleTimeoutMillis: 30_000,
});

function integerQuery(value, name, { fallback, min, max }) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new AppError(400, "INVALID_QUERY", `${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function optionalYear(value, name) {
  if (value === undefined || value === "") return undefined;
  return integerQuery(value, name, { min: 1880, max: 2100 });
}

function optionalString(value, name, maxLength) {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string") throw new AppError(400, "INVALID_QUERY", `${name} must be a string`);
  const cleaned = value.trim();
  if (cleaned.length > maxLength) {
    throw new AppError(400, "INVALID_QUERY", `${name} cannot exceed ${maxLength} characters`);
  }
  return cleaned || undefined;
}

app.get("/", (_req, res) => {
  res.json({
    service: "pgvector movie backend",
    endpoints: ["GET /api/health", "POST /api/chat", "GET /api/movies", "GET /api/movies/filters"],
  });
});

app.get(
  "/api/health",
  asyncRoute(async (_req, res) => {
    const result = await pool.query(`
      SELECT current_database() AS database_name,
             current_user AS database_user,
             NOW() AS checked_at,
             EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS vector_enabled,
             COALESCE((SELECT extversion FROM pg_extension WHERE extname = 'vector'), 'not installed') AS vector_version,
             (SELECT COUNT(*)::integer FROM movies) AS movie_count,
             (SELECT COUNT(embedding)::integer FROM movies) AS embedding_count
    `);
    const row = result.rows[0];

    res.json({
      status: "ok",
      backend: "running",
      database: {
        status: "connected",
        name: row.database_name,
        user: row.database_user,
        checkedAt: row.checked_at,
        movieCount: row.movie_count,
        embeddingCount: row.embedding_count,
      },
      pgvector: { enabled: row.vector_enabled, version: row.vector_version },
      services: {
        embedderUrl: config.embedder.baseUrl,
        geminiModel: config.gemini.model,
        geminiConfigured: Boolean(config.gemini.apiKey && config.gemini.model),
      },
    });
  })
);

app.post(
  "/api/chat",
  asyncRoute(async (req, res) => {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) throw new AppError(400, "INVALID_MESSAGE", "message is required");
    if (message.length > 2000) {
      throw new AppError(400, "INVALID_MESSAGE", "message cannot exceed 2000 characters");
    }

    const topK =
      req.body?.topK === undefined
        ? config.rag.topK
        : integerQuery(req.body.topK, "topK", { min: 1, max: config.rag.maxTopK });

    const embedding = await createEmbedding(message, config.embedder);
    const movies = await searchSimilarMovies(pool, embedding, topK);
    if (!movies.length) {
      throw new AppError(503, "NO_EMBEDDED_MOVIES", "No embedded movies are available for recommendations");
    }

    const answer = await recommendWithGemini(message, movies, config.gemini);
    res.json({
      answer,
      movies: movies.map((movie) => ({
        id: movie.id,
        title: movie.title,
        overview: movie.overview,
        tagline: movie.tagline,
        genres: movie.genres,
        releaseYear: movie.release_year,
        voteAverage: movie.vote_average === null ? null : Number(movie.vote_average),
        similarity: Number(movie.similarity),
      })),
    });
  })
);

app.get(
  "/api/movies/filters",
  asyncRoute(async (_req, res) => {
    const filters = await getMovieFilters(pool);
    res.json({
      genres: filters.genres,
      minYear: filters.min_year,
      maxYear: filters.max_year,
    });
  })
);

app.get(
  "/api/movies",
  asyncRoute(async (req, res) => {
    const page = integerQuery(req.query.page, "page", { fallback: 1, min: 1, max: 1_000_000 });
    const limit = integerQuery(req.query.limit, "limit", { fallback: 20, min: 1, max: 100 });
    const sort = optionalString(req.query.sort, "sort", 30) || "title";
    const order = optionalString(req.query.order, "order", 4)?.toLowerCase() || "asc";
    if (!Object.hasOwn(SORT_COLUMNS, sort)) {
      throw new AppError(400, "INVALID_QUERY", `sort must be one of: ${Object.keys(SORT_COLUMNS).join(", ")}`);
    }
    if (!new Set(["asc", "desc"]).has(order)) {
      throw new AppError(400, "INVALID_QUERY", "order must be asc or desc");
    }

    const yearFrom = optionalYear(req.query.yearFrom, "yearFrom");
    const yearTo = optionalYear(req.query.yearTo, "yearTo");
    if (yearFrom !== undefined && yearTo !== undefined && yearFrom > yearTo) {
      throw new AppError(400, "INVALID_QUERY", "yearFrom cannot be greater than yearTo");
    }

    const q = optionalString(req.query.q, "q", 200);
    const genre = optionalString(req.query.genre, "genre", 80);
    const result = await listMovies(pool, {
      limit,
      offset: (page - 1) * limit,
      q,
      genre,
      yearFrom,
      yearTo,
      sort,
      order,
    });

    res.json({
      items: result.items,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
      filters: { q: q || null, genre: genre || null, yearFrom, yearTo, sort, order },
    });
  })
);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`Backend listening on port ${config.port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

module.exports = { app, pool };
