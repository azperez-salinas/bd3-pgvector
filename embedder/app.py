"""Microservicio de embeddings: mismo modelo y prefijos que scripts/02_embed.py.

POST /embed  {"text": "...", "kind": "query" | "passage"}  ->  {"embedding": [768 floats]}
"""
from fastapi import FastAPI
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

MODEL = "intfloat/multilingual-e5-base"
PREFIX = {"query": "query: ", "passage": "passage: "}

app = FastAPI(title="embedder")
model = SentenceTransformer(MODEL)
model.max_seq_length = 512


class EmbedRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    kind: str = Field(default="query", pattern="^(query|passage)$")


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL, "dimensions": 768}


@app.post("/embed")
def embed(req: EmbedRequest):
    vec = model.encode(PREFIX[req.kind] + req.text, normalize_embeddings=True)
    return {"embedding": vec.tolist()}
