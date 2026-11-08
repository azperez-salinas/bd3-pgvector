"""Genera embeddings con intfloat/multilingual-e5-base (768d, local) y los cachea.

  - Prefijo "passage: " para documentos ("query: " en la consulta).
  - Vectores normalizados L2 (coherente con la distancia coseno del índice).
  - Sin cuotas ni API key. La primera ejecución descarga el modelo (~1 GB).
"""
import json

import numpy as np

from common import CLEAN_JSONL, DOC_PREFIX, EMB_IDS, EMB_NPY, EMBED_DIM, load_model


def main():
    rows = [json.loads(l) for l in open(CLEAN_JSONL, encoding="utf-8")]
    ids = [r["id"] for r in rows]
    texts = [DOC_PREFIX + r["embedding_text"] for r in rows]

    model = load_model()
    emb = model.encode(
        texts,
        batch_size=32,
        normalize_embeddings=True,
        show_progress_bar=True,
        convert_to_numpy=True,
    ).astype(np.float32)
    assert emb.shape == (len(rows), EMBED_DIM), emb.shape

    EMB_NPY.parent.mkdir(exist_ok=True)
    np.save(EMB_NPY, emb)
    json.dump(ids, open(EMB_IDS, "w"))
    print(f"Listo: {emb.shape} -> {EMB_NPY}")


if __name__ == "__main__":
    main()
