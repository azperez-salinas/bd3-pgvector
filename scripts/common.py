"""Configuración compartida por los scripts del pipeline."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
RAW_CSV = ROOT / "database" / "tmdb_5000_movies.csv"
CLEAN_JSONL = DATA_DIR / "movies_clean.jsonl"
EMB_NPY = DATA_DIR / "embeddings_e5base_768.npy"
EMB_IDS = DATA_DIR / "embeddings_e5base_768_ids.json"

# Modelo multilingüe local (Hugging Face). e5 exige prefijos distintos
# para documentos y consultas.
EMBED_MODEL = "intfloat/multilingual-e5-base"
EMBED_DIM = 768
DOC_PREFIX = "passage: "
QUERY_PREFIX = "query: "

load_dotenv(Path(__file__).resolve().parent / ".env")


def db_dsn() -> str:
    return (
        f"host={os.getenv('PGHOST', 'localhost')} "
        f"port={os.getenv('PGPORT', '5433')} "
        f"dbname={os.getenv('PGDATABASE', 'app_db')} "
        f"user={os.getenv('PGUSER', 'app_user')} "
        f"password={os.getenv('PGPASSWORD', 'app_password')}"
    )


def load_model():
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(EMBED_MODEL)
    model.max_seq_length = 512
    return model
