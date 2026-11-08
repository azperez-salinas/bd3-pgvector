"""Carga data/movies_clean.jsonl (+ embeddings cacheados si existen) en Postgres.

Idempotente: hace UPSERT por id. Sin embeddings, carga las películas con
embedding NULL (útil para la pestaña de exploración antes de tener la API key).
"""
import json
from datetime import date

import numpy as np
import psycopg
from pgvector.psycopg import register_vector

from common import CLEAN_JSONL, EMB_IDS, EMB_NPY, db_dsn

COLS = [
    "id", "title", "original_title", "original_language", "overview", "tagline",
    "genres", "keywords", "release_date", "release_year", "runtime", "budget",
    "revenue", "vote_average", "vote_count", "popularity", "status", "embedding_text",
]

SQL = f"""
INSERT INTO movies ({", ".join(COLS)}, embedding)
VALUES ({", ".join(["%s"] * (len(COLS) + 1))})
ON CONFLICT (id) DO UPDATE SET
  {", ".join(f"{c} = EXCLUDED.{c}" for c in COLS[1:] + ["embedding"])}
"""


def main():
    rows = [json.loads(l) for l in open(CLEAN_JSONL, encoding="utf-8")]

    emb = {}
    if EMB_NPY.exists() and EMB_IDS.exists():
        emb = dict(zip(json.load(open(EMB_IDS)), np.load(EMB_NPY)))
        print(f"Embeddings cacheados: {len(emb)}")
    else:
        print("Sin embeddings cacheados: se cargará con embedding NULL")

    with psycopg.connect(db_dsn()) as conn:
        register_vector(conn)
        with conn.cursor() as cur:
            for r in rows:
                if r["release_date"]:
                    r["release_date"] = date.fromisoformat(r["release_date"])
                cur.execute(SQL, [r[c] for c in COLS] + [emb.get(r["id"])])
        conn.commit()
        n, ne = conn.execute("SELECT count(*), count(embedding) FROM movies").fetchone()
    print(f"movies: {n} filas, {ne} con embedding")


if __name__ == "__main__":
    main()
