"""
upload.py
---------
POST /upload  — accepts a file, runs the full ingestion pipeline:
  1. Save file to disk temporarily
  2. Extract text (extractor.py)
  3. Chunk text (chunker.py)
  4. Embed chunks (embedder.py)
  5. Store in vector DB (vector_store.py)
  6. Return document metadata

GET /documents         — list all documents
GET /documents/{id}    — get single document status
DELETE /documents/{id} — remove document + its chunks
"""

import os
import uuid
import tempfile
import asyncio
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse

from models.schemas import DocumentResponse, IngestionStatus
from services import extractor, chunker, embedder, vector_store
from config import settings

router = APIRouter(prefix="/api", tags=["documents"])

ALLOWED_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "docx",
    "image/png": "image",
    "image/jpeg": "image",
    "image/webp": "image",
    "image/tiff": "image",
}


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """
    Upload a document and kick off background ingestion.
    Returns immediately with doc_id so the frontend can poll status.
    """
    # Validate file type
    file_type = ALLOWED_TYPES.get(file.content_type)
    if not file_type:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {file.content_type}. "
                   f"Supported: PDF, DOCX, PNG, JPG, WEBP",
        )

    # Validate file size
    contents = await file.read()
    size_bytes = len(contents)
    max_bytes = settings.max_file_size_mb * 1024 * 1024
    if size_bytes > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_bytes // 1024 // 1024}MB). Max: {settings.max_file_size_mb}MB",
        )

    doc_id = str(uuid.uuid4())

    # Create DB record immediately (status='processing')
    vector_store.create_document(
        doc_id=doc_id,
        filename=file.filename,
        file_type=file_type,
        size_bytes=size_bytes,
    )

    # Run ingestion in background so we can return fast
    background_tasks.add_task(
        _run_ingestion,
        doc_id=doc_id,
        filename=file.filename,
        contents=contents,
    )

    return {
        "doc_id": doc_id,
        "filename": file.filename,
        "status": "processing",
        "message": "File uploaded. Ingestion started.",
    }


async def _run_ingestion(doc_id: str, filename: str, contents: bytes):
    """
    Background task: full ingestion pipeline.
    Updates document status in DB at each step.
    """
    tmp_path = None
    try:
        # Write to temp file (extractors need a file path)
        suffix = "." + filename.rsplit(".", 1)[-1]
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        # Step 1: Extract text
        pages = extractor.extract(tmp_path, filename)
        if not pages:
            raise ValueError("No text could be extracted from this file.")

        # Step 2: Chunk
        chunks = chunker.chunk_pages(pages, doc_id)
        if not chunks:
            raise ValueError("Document produced no chunks after splitting.")

        # Step 3: Embed (async, batched)
        chunks_with_embeddings = await embedder.embed_chunks(chunks)

        # Step 4: Store in vector DB
        vector_store.insert_chunks(chunks_with_embeddings)

        # Step 5: Mark as ready
        vector_store.update_document_status(
            doc_id=doc_id,
            status="ready",
            page_count=len(pages),
            chunk_count=len(chunks),
        )

    except Exception as e:
        vector_store.update_document_status(
            doc_id=doc_id,
            status="error",
            error_message=str(e),
        )
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.get("/documents")
def list_documents():
    """Return all documents, newest first."""
    docs = vector_store.list_documents()
    return {"documents": docs}


@router.get("/documents/{doc_id}")
def get_document(doc_id: str):
    """Poll this endpoint to check ingestion status."""
    doc = vector_store.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/documents/{doc_id}")
def delete_document(doc_id: str):
    """Delete document and all its chunks from the vector store."""
    doc = vector_store.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    vector_store.delete_chunks_for_doc(doc_id)
    # Supabase FK cascade will also handle this, but be explicit
    return {"message": f"Document {doc_id} deleted"}
