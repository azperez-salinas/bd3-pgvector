"""Limpia tmdb_5000_movies.csv y construye el texto a embeber.

Reglas (decididas con el usuario):
  - Se descartan las películas sin overview (nulo o vacío).
  - Se conservan Rumored / Post Production y las de 0 votos.
  - budget, revenue y runtime = 0  ->  NULL (en TMDB 0 significa "desconocido").
  - genres y keywords (JSON como texto) -> listas de nombres.
  - Un chunk por película: título + año + géneros + keywords + tagline + overview.
"""
import json
import re

import pandas as pd

from common import CLEAN_JSONL, DATA_DIR, RAW_CSV


def names(json_text) -> list[str]:
    try:
        return [d["name"].strip() for d in json.loads(json_text) if d.get("name")]
    except (TypeError, ValueError):
        return []


def squash(text) -> str | None:
    """Colapsa espacios/saltos de línea; devuelve None si queda vacío."""
    if pd.isna(text):
        return None
    out = re.sub(r"\s+", " ", str(text)).strip()
    return out or None


def build_text(r) -> str:
    head = r["title"] + (f" ({r['release_year']})" if pd.notna(r["release_year"]) else "")
    parts = [head + "."]
    if r["genres"]:
        parts.append("Genres: " + ", ".join(r["genres"]) + ".")
    if r["keywords"]:
        parts.append("Keywords: " + ", ".join(r["keywords"]) + ".")
    if pd.notna(r["tagline"]):
        parts.append("Tagline: " + r["tagline"])
    parts.append("Overview: " + r["overview"])
    return " ".join(parts)


def main():
    df = pd.read_csv(RAW_CSV)
    report = {"filas_originales": len(df)}

    for col in ("title", "original_title", "overview", "tagline"):
        df[col] = df[col].map(squash)

    # 1) Duplicados por id (no hay, se verifica igualmente)
    df = df.drop_duplicates(subset="id")

    # 2) Descartar sin overview
    sin_overview = df["overview"].isna()
    report["descartadas_sin_overview"] = int(sin_overview.sum())
    df = df[~sin_overview].copy()

    # 3) Ceros -> NULL
    for col in ("budget", "revenue", "runtime"):
        report[f"{col}_cero_o_nulo_a_NULL"] = int((df[col].fillna(0) == 0).sum())
        df[col] = df[col].where(df[col].fillna(0) > 0)

    # 4) Fechas / año
    df["release_date"] = pd.to_datetime(df["release_date"], errors="coerce")
    df["release_year"] = df["release_date"].dt.year.astype("Int64")
    report["sin_release_date"] = int(df["release_date"].isna().sum())

    # 5) JSON -> listas
    df["genres"] = df["genres"].map(names)
    df["keywords"] = df["keywords"].map(names)

    # 6) Texto a embeber
    df["embedding_text"] = df.apply(build_text, axis=1)

    out = df[
        [
            "id", "title", "original_title", "original_language", "overview",
            "tagline", "genres", "keywords", "release_date", "release_year",
            "runtime", "budget", "revenue", "vote_average", "vote_count",
            "popularity", "status", "embedding_text",
        ]
    ].copy()
    out["release_date"] = out["release_date"].dt.strftime("%Y-%m-%d")
    out = out.astype(object).where(out.notna(), None)

    DATA_DIR.mkdir(exist_ok=True)
    with open(CLEAN_JSONL, "w", encoding="utf-8") as f:
        for rec in out.to_dict(orient="records"):
            f.write(json.dumps(rec, ensure_ascii=False, default=int) + "\n")

    report["filas_finales"] = len(out)
    lens = out["embedding_text"].str.split().str.len()
    report["palabras_texto_embedding(min/media/max)"] = [
        int(lens.min()), round(float(lens.mean()), 1), int(lens.max())
    ]
    print(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"-> {CLEAN_JSONL}")
    print("\nEjemplo:\n" + out.iloc[0]["embedding_text"])


if __name__ == "__main__":
    main()
