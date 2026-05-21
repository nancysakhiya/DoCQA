"""
llm.py
------
Builds the RAG prompt and streams the LLM answer.
"""

from models.schemas import CitedSource
from config import settings
from typing import AsyncIterator
import ollama


SYSTEM_PROMPT = """You are an expert document analyst assistant.

Your job is to answer the user's question using ONLY the provided document context.

RULES:
1. Answer based ONLY on the context provided.
2. Add inline citations like [filename.pdf, p.3]
3. If information is missing, say so clearly.
4. Never hallucinate facts.
"""


def _build_context_block(sources: list[CitedSource]) -> str:
    blocks = []

    for i, src in enumerate(sources, 1):
        blocks.append(
            f"[Source {i}: {src.filename}, Page {src.page_num}]\n{src.chunk_text}"
        )

    return "\n\n---\n\n".join(blocks)


def _build_messages(
    question: str,
    sources: list[CitedSource],
    conversation_history: list[dict],
) -> list[dict]:

    context = _build_context_block(sources)

    user_message = f"""
DOCUMENT CONTEXT:
{context}

QUESTION:
{question}

Remember to cite sources.
"""

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    recent_history = conversation_history[-6:]
    messages.extend(recent_history)

    messages.append(
        {
            "role": "user",
            "content": user_message
        }
    )

    return messages


async def stream_answer(
    question: str,
    sources: list[CitedSource],
    conversation_history: list[dict] = [],
) -> AsyncIterator[str]:

    messages = _build_messages(
        question,
        sources,
        conversation_history
    )

    stream = ollama.chat(
        model=settings.llm_model,
        messages=messages,
        stream=True,
    )

    for chunk in stream:
        content = chunk["message"]["content"]

        if content:
            yield content


async def get_answer(
    question: str,
    sources: list[CitedSource],
    conversation_history: list[dict] = [],
) -> str:

    full_answer = ""

    async for token in stream_answer(
        question,
        sources,
        conversation_history
    ):
        full_answer += token

    return full_answer


async def rewrite_query(
    question: str,
    conversation_history: list[dict] = [],
) -> str:

    history_text = ""

    if conversation_history:
        last_turn = conversation_history[-2:]

        history_text = "\n".join(
            f"{m['role'].upper()}: {m['content'][:200]}"
            for m in last_turn
        )

    prompt = f"""
Rewrite the following question into a better semantic search query.

Previous conversation:
{history_text}

Question:
{question}

Rewritten query:
"""

    response = ollama.chat(
        model=settings.llm_model,
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    return response["message"]["content"].strip()