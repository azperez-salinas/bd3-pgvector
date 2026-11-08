require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(express.json());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  })
);

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "app_db",
  user: process.env.PGUSER || "app_user",
  password: process.env.PGPASSWORD || "app_password",
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

app.get("/", (_req, res) => {
  res.json({
    service: "pgvector movie backend",
    endpoints: ["GET /api/health"],
  });
});

app.get("/api/health", async (_req, res) => {
  let client;

  try {
    client = await pool.connect();

    const dbResult = await client.query(`
      SELECT
        current_database() AS database_name,
        current_user AS database_user,
        NOW() AS checked_at
    `);

    const vectorResult = await client.query(`
      SELECT
        EXISTS (
          SELECT 1
          FROM pg_extension
          WHERE extname = 'vector'
        ) AS enabled,
        COALESCE(
          (
            SELECT extversion
            FROM pg_extension
            WHERE extname = 'vector'
          ),
          'not installed'
        ) AS version
    `);

    const metadataResult = await client.query(`
      SELECT value
      FROM app_metadata
      WHERE key = 'database_status'
      LIMIT 1
    `);

    res.json({
      status: "ok",
      backend: "running",
      database: {
        status: "connected",
        name: dbResult.rows[0].database_name,
        user: dbResult.rows[0].database_user,
        checkedAt: dbResult.rows[0].checked_at,
      },
      pgvector: {
        enabled: vectorResult.rows[0].enabled,
        version: vectorResult.rows[0].version,
      },
      message: metadataResult.rows[0]?.value || "Database is reachable.",
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      backend: "running",
      database: {
        status: "disconnected",
      },
      pgvector: {
        enabled: false,
      },
      message: error.message,
    });
  } finally {
    if (client) client.release();
  }
});

process.on("SIGINT", async () => {
  await pool.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Backend listening on port ${port}`);
});
