-- ============================================================
-- MULTIMODAL DOC QA — SUPABASE SETUP
-- Run this entire file in your Supabase SQL Editor
-- (Project → SQL Editor → New query → paste → Run)
-- ============================================================

-- 1. Enable pgvector extension
create extension if not exists vector;

-- 2. Documents table
create table if not exists documents (
  id            uuid primary key default gen_random_uuid(),
  filename      text not null,
  file_type     text not null,        -- "pdf" | "docx" | "image"
  size_bytes    bigint not null,
  status        text not null default 'processing',  -- "processing" | "ready" | "error"
  page_count    int,
  chunk_count   int,
  error_message text,
  created_at    timestamptz default now()
);

-- 3. Chunks table with 1536-dim vector column
create table if not exists chunks (
  id        uuid primary key default gen_random_uuid(),
  doc_id    uuid references documents(id) on delete cascade,
  content   text not null,
  embedding vector(1536),
  metadata  jsonb not null default '{}'
);

-- 4. IVFFlat index for approximate nearest neighbour search
--    NOTE: Build this AFTER you have at least 100 rows for best results.
--    Drop and rebuild it once you have data: 
--      DROP INDEX IF EXISTS chunks_embedding_idx;
--      CREATE INDEX ...
create index if not exists chunks_embedding_idx
  on chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 5. Similarity search RPC function
--    Called from vector_store.py as supabase.rpc("match_chunks", {...})
create or replace function match_chunks(
  query_embedding vector(1536),
  filter_doc_ids  uuid[],
  match_count     int default 5
)
returns table (
  id          uuid,
  doc_id      uuid,
  content     text,
  metadata    jsonb,
  similarity  float
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

-- 6. Row Level Security (optional but recommended for production)
-- alter table documents enable row level security;
-- alter table chunks enable row level security;
-- For now, the service key bypasses RLS, so leave it off for dev.

-- Verify setup:
-- select * from documents limit 5;
-- select count(*) from chunks;
