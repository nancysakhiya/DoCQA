"""
embedder.py
-----------
Local embedding generator using SentenceTransformers.

Model:
  all-MiniLM-L6-v2

Why this model?
  - Completely free
  - Runs locally
  - Fast
  - Good retrieval quality
  - No OpenAI API needed
  - 384-dimensional vectors

IMPORTANT:
If you previously stored 1536-d vectors in Supabase,
you must recreate the table for 384-d vectors.
"""

from sentence_transformers import SentenceTransformer
from models.schemas import Chunk

# Load local embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")


async def embed_chunks(chunks: list[Chunk]) -> list[tuple[Chunk, list[float]]]:
    """
    Embeds all chunks locally.
    Returns list of (chunk, embedding_vector) tuples.
    """

    results = []

    texts = [c.content for c in chunks]

    embeddings = model.encode(texts)

    for chunk, embedding in zip(chunks, embeddings):
        results.append((chunk, embedding.tolist()))

    return results


async def embed_query(text: str) -> list[float]:
    """
    Embeds query locally for similarity search.
    Must use same model as chunk embeddings.
    """

    embedding = model.encode(text)

    return embedding.tolist()