"""
vector_store.py
---------------
All database operations against Supabase + pgvector.

Tables used:
  documents — one row per uploaded file
  chunks    — one row per text chunk, with vector column

Before running this app, run this SQL in your Supabase SQL editor:

  -- Enable pgvector extension
  create extension if not exists vector;

  -- Documents table
  create table documents (
    id            uuid primary key default gen_random_uuid(),
    filename      text not null,
    file_type     text not null,
    size_bytes    bigint not null,
    status        text not null default 'processing',
    page_count    int,
    chunk_count   int,
    error_message text,
    created_at    timestamptz default now()
  );

  -- Chunks table with vector column
  create table chunks (
    id        uuid primary key default gen_random_uuid(),
    doc_id    uuid references documents(id) on delete cascade,
    content   text not null,
    embedding vector(1536),
    metadata  jsonb not null default '{}'
  );

  -- IVFFlat index for fast approximate nearest neighbour search
  -- Build AFTER inserting data (needs at least 100 rows to be useful)
  create index on chunks using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);

  -- RPC function for similarity search (called from vector_store.py)
  create or replace function match_chunks(
    query_embedding vector(1536),
    filter_doc_ids  uuid[],
    match_count     int default 5
  )
  returns table (
    id               uuid,
    doc_id           uuid,
    content          text,
    metadata         jsonb,
    similarity       float
  )
  language sql stable
  as $$
    select
      c.id,
      c.doc_id,
      c.content,
      c.metadata,
      1 - (c.embedding <=> query_embedding) as similarity
    from chunks c
    where c.doc_id = any(filter_doc_ids)
    order by c.embedding <=> query_embedding
    limit match_count;
  $$;
"""

import json
from supabase import create_client, Client
from models.schemas import Chunk, CitedSource, DocumentResponse
from config import settings
from datetime import datetime

# Initialise Supabase client (synchronous — wrap in run_in_executor if needed)
_client: Client = create_client(settings.supabase_url, settings.supabase_service_key)


# ── Documents ───────────────────────────────────────────────────────────────

def create_document(doc_id: str, filename: str, file_type: str, size_bytes: int) -> dict:
    """Insert a new document row with status='processing'."""
    data = {
        "id": doc_id,
        "filename": filename,
        "file_type": file_type,
        "size_bytes": size_bytes,
        "status": "processing",
    }
    result = _client.table("documents").insert(data).execute()
    return result.data[0]


def update_document_status(
    doc_id: str,
    status: str,
    page_count: int = None,
    chunk_count: int = None,
    error_message: str = None,
):
    """Update status after ingestion completes (or fails)."""
    updates = {"status": status}
    if page_count is not None:
        updates["page_count"] = page_count
    if chunk_count is not None:
        updates["chunk_count"] = chunk_count
    if error_message is not None:
        updates["error_message"] = error_message

    _client.table("documents").update(updates).eq("id", doc_id).execute()


def get_document(doc_id: str) -> dict | None:
    result = _client.table("documents").select("*").eq("id", doc_id).execute()
    return result.data[0] if result.data else None


def list_documents() -> list[dict]:
    result = (
        _client.table("documents")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


# ── Chunks ──────────────────────────────────────────────────────────────────

def insert_chunks(chunks_with_embeddings: list[tuple[Chunk, list[float]]]):
    """
    Bulk-insert chunks + their embeddings into the chunks table.
    Batches of 50 to stay within Supabase request size limits.
    """
    BATCH = 50
    rows = [
        {
            "id": chunk.id,
            "doc_id": chunk.doc_id,
            "content": chunk.content,
            "embedding": embedding,           # pgvector accepts list[float]
            "metadata": chunk.metadata.model_dump(),
        }
        for chunk, embedding in chunks_with_embeddings
    ]

    for i in range(0, len(rows), BATCH):
        _client.table("chunks").insert(rows[i : i + BATCH]).execute()


def delete_chunks_for_doc(doc_id: str):
    """Called when a document is deleted — cascades via FK anyway, but explicit is safer."""
    _client.table("chunks").delete().eq("doc_id", doc_id).execute()


# ── Similarity search ───────────────────────────────────────────────────────

def similarity_search(
    query_embedding: list[float],
    doc_ids: list[str],
    top_k: int = 5,
) -> list[CitedSource]:
    """
    Calls the match_chunks SQL function defined in the docstring above.
    Returns top-k most relevant chunks as CitedSource objects.
    """
    result = _client.rpc(
        "match_chunks",
        {
            "query_embedding": query_embedding,
            "filter_doc_ids": doc_ids,
            "match_count": top_k,
        },
    ).execute()

    sources = []
    for row in result.data:
        meta = row["metadata"]
        sources.append(
            CitedSource(
                doc_id=row["doc_id"],
                filename=meta.get("filename", "unknown"),
                page_num=meta.get("page_num", 0),
                chunk_text=row["content"],
                similarity_score=round(row["similarity"], 4),
            )
        )

    return sources
