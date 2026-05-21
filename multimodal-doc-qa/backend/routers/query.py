"""
query.py
--------
POST /api/query         — full RAG pipeline, returns JSON
POST /api/query/stream  — same pipeline but streams tokens via SSE

SSE format:
  data: {"type": "token", "content": "Hello"}
  data: {"type": "sources", "sources": [...]}
  data: {"type": "done"}
"""

import json
import asyncio
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models.schemas import QueryRequest, QueryResponse
from services import embedder, vector_store, llm
from config import settings

router = APIRouter(prefix="/api", tags=["query"])


@router.post("/query", response_model=QueryResponse)
async def query_documents(req: QueryRequest):
    """
    Non-streaming RAG endpoint.
    Good for testing; use /query/stream for production UI.
    """
    if not req.doc_ids:
        raise HTTPException(status_code=400, detail="Provide at least one doc_id to search")
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    # Step 1: Optionally rewrite query for better retrieval
    search_query = await llm.rewrite_query(req.question, req.conversation_history)

    # Step 2: Embed the (rewritten) query
    query_vector = await embedder.embed_query(search_query)

    # Step 3: Retrieve top-k relevant chunks
    sources = vector_store.similarity_search(
        query_embedding=query_vector,
        doc_ids=req.doc_ids,
        top_k=req.top_k or settings.top_k_results,
    )

    if not sources:
        return QueryResponse(
            answer="No relevant content found in the selected documents for your question.",
            sources=[],
            question=req.question,
        )

    # Step 4: Generate answer
    answer = await llm.get_answer(req.question, sources, req.conversation_history)

    return QueryResponse(answer=answer, sources=sources, question=req.question)


@router.post("/query/stream")
async def stream_query(req: QueryRequest):
    """
    Streaming RAG endpoint using Server-Sent Events.

    The frontend reads this with:
      const es = new EventSource(...)  or  fetch() + ReadableStream

    Event types sent:
      {"type": "status", "message": "Searching documents..."}
      {"type": "token",  "content": "The revenue..."}
      {"type": "sources", "sources": [{...}, ...]}
      {"type": "done"}
      {"type": "error",  "message": "..."}
    """
    if not req.doc_ids:
        raise HTTPException(status_code=400, detail="Provide at least one doc_id")

    async def event_generator():
        try:
            # Status: rewriting query
            yield _sse({"type": "status", "message": "Analysing your question..."})
            await asyncio.sleep(0)

            search_query = await llm.rewrite_query(req.question, req.conversation_history)

            # Status: searching
            yield _sse({"type": "status", "message": f"Searching across {len(req.doc_ids)} document(s)..."})
            await asyncio.sleep(0)

            query_vector = await embedder.embed_query(search_query)
            sources = vector_store.similarity_search(
                query_embedding=query_vector,
                doc_ids=req.doc_ids,
                top_k=req.top_k or settings.top_k_results,
            )

            if not sources:
                yield _sse({
                    "type": "token",
                    "content": "No relevant content found in the selected documents.",
                })
                yield _sse({"type": "done"})
                return

            # Status: generating
            yield _sse({"type": "status", "message": "Generating answer..."})
            await asyncio.sleep(0)

            # Stream answer tokens
            async for token in llm.stream_answer(
                req.question, sources, req.conversation_history
            ):
                yield _sse({"type": "token", "content": token})

            # Send sources after answer is complete
            yield _sse({
                "type": "sources",
                "sources": [s.model_dump() for s in sources],
            })

            yield _sse({"type": "done"})

        except Exception as e:
            yield _sse({"type": "error", "message": str(e)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disables Nginx buffering
        },
    )


def _sse(data: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(data)}\n\n"
