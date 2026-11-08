"""Prueba de la búsqueda por similitud:  python 04_search.py "una película sobre..." [k]

Embebe la consulta ("query: " + texto, normalizada) con el mismo modelo local y
llama a la función SQL search_movies(), que hace ORDER BY embedding <=> consulta.
"""
import sys

import psycopg
from pgvector.psycopg import register_vector

from common import QUERY_PREFIX, db_dsn, load_model


def search(text: str, k: int = 5, model=None):
    model = model or load_model()
    q = model.encode(QUERY_PREFIX + text, normalize_embeddings=True)
    with psycopg.connect(db_dsn()) as conn:
        register_vector(conn)
        return conn.execute(
            "SELECT id, title, release_year, genres, similarity "
            "FROM search_movies(%s::vector(768), %s)",
            (q, k),
        ).fetchall()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit('Uso: python 04_search.py "consulta" [k]')
    k = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    for id_, title, year, genres, sim in search(sys.argv[1], k):
        print(f"{sim:.3f}  {title} ({year})  {', '.join(genres)}")
