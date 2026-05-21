"""
chunker.py
----------
Splits extracted pages into overlapping chunks ready for embedding.

Why overlap?
  If a sentence spans two chunks, the answer won't get cut off.
  chunk_overlap=50 means the last 50 tokens of chunk N appear at
  the start of chunk N+1.

Returns list of Chunk objects with full metadata for citations.
"""

import uuid
from langchain_text_splitters import RecursiveCharacterTextSplitter
from models.schemas import Chunk, ChunkMetadata
from config import settings


def chunk_pages(pages: list[dict], doc_id: str) -> list[Chunk]:
    """
    Takes output of extractor.extract() and returns a flat list of Chunk objects.

    Each chunk carries:
      - doc_id      : links back to the parent document
      - filename    : for display in citations
      - page_num    : which page this chunk came from
      - chunk_index : position within the page (for ordering)
      - char_start/end: character offsets within the page text
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", "! ", "? ", " ", ""],
    )

    all_chunks: list[Chunk] = []

    for page in pages:
        page_text: str = page["text"]
        page_num: int = page["page"]
        filename: str = page["source"]

        # Split this page's text into sub-chunks
        raw_chunks = splitter.split_text(page_text)

        # Track character offsets for source highlighting later
        search_start = 0
        for idx, chunk_text in enumerate(raw_chunks):
            # Find where in the original page text this chunk starts
            char_start = page_text.find(chunk_text, search_start)
            if char_start == -1:
                char_start = search_start  # fallback
            char_end = char_start + len(chunk_text)
            search_start = max(0, char_end - settings.chunk_overlap)

            chunk = Chunk(
                id=str(uuid.uuid4()),
                doc_id=doc_id,
                content=chunk_text,
                metadata=ChunkMetadata(
                    doc_id=doc_id,
                    filename=filename,
                    page_num=page_num,
                    chunk_index=idx,
                    char_start=char_start,
                    char_end=char_end,
                ),
            )
            all_chunks.append(chunk)

    return all_chunks


def estimate_chunk_count(pages: list[dict]) -> int:
    """
    Quick estimate without actually chunking — useful for progress bars.
    """
    total_chars = sum(len(p["text"]) for p in pages)
    # rough estimate: chunk_size chars per chunk with some overlap
    return max(1, total_chars // (settings.chunk_size - settings.chunk_overlap // 2))
