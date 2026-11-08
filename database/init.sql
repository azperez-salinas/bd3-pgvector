-- =====================================================================
-- Esquema de la base de datos (se ejecuta solo la primera vez que se
-- crea el volumen de Postgres, vía /docker-entrypoint-initdb.d).
-- Para reaplicarlo:  docker compose down -v && docker compose up -d db
-- =====================================================================

-- Extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Metadatos de la app (usado por /api/health del backend)
CREATE TABLE IF NOT EXISTS app_metadata (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_metadata (key, value)
VALUES ('database_status', 'pgvector database initialized')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ---------------------------------------------------------------------
-- Películas (dataset TMDB 5000, ya limpio).
-- 1 fila = 1 chunk = 1 película. El embedding se calcula sobre
-- embedding_text (título + géneros + keywords + tagline + overview).
-- Modelo: intfloat/multilingual-e5-base (local), 768 dimensiones (normalizadas L2).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movies (
    id                INTEGER PRIMARY KEY,          -- id de TMDB
    title             TEXT NOT NULL,
    original_title    TEXT,
    original_language TEXT,
    overview          TEXT NOT NULL,
    tagline           TEXT,
    genres            TEXT[]  NOT NULL DEFAULT '{}',
    keywords          TEXT[]  NOT NULL DEFAULT '{}',
    release_date      DATE,
    release_year      INTEGER,
    runtime           INTEGER,                      -- minutos; NULL = desconocido
    budget            BIGINT,                       -- NULL = desconocido
    revenue           BIGINT,                       -- NULL = desconocido
    vote_average      NUMERIC(3, 1),
    vote_count        INTEGER,
    popularity        DOUBLE PRECISION,
    status            TEXT,
    embedding_text    TEXT NOT NULL,                -- texto exacto que se embebió
    embedding         VECTOR(768),
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Índice ANN: HNSW con distancia coseno (operador <=>)
CREATE INDEX IF NOT EXISTS movies_embedding_hnsw_idx
    ON movies USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Índices de apoyo para la pestaña de exploración
CREATE INDEX IF NOT EXISTS movies_genres_gin_idx ON movies USING gin (genres);
CREATE INDEX IF NOT EXISTS movies_release_year_idx ON movies (release_year);
CREATE INDEX IF NOT EXISTS movies_title_idx ON movies (lower(title));

-- ---------------------------------------------------------------------
-- Búsqueda por similitud.
-- similarity = 1 - distancia coseno  (1 = idéntico, 0 = ortogonal).
-- Uso:  SELECT * FROM search_movies('[0.01, ...]'::vector(768), 5);
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_movies(
    query_embedding VECTOR(768),
    match_count     INTEGER DEFAULT 5
)
RETURNS TABLE (
    id             INTEGER,
    title          TEXT,
    overview       TEXT,
    tagline        TEXT,
    genres         TEXT[],
    release_year   INTEGER,
    vote_average   NUMERIC,
    embedding_text TEXT,
    similarity     DOUBLE PRECISION
)
LANGUAGE sql STABLE AS $$
    SELECT m.id,
           m.title,
           m.overview,
           m.tagline,
           m.genres,
           m.release_year,
           m.vote_average,
           m.embedding_text,
           1 - (m.embedding <=> query_embedding) AS similarity
    FROM movies m
    WHERE m.embedding IS NOT NULL
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_count;
$$;
