"""
src/rlhf/rag_retriever.py
━━━━━━━━━━━━━━━━━━━━━━━━━
Retrieves the most similar past human-approved nurture emails from Qdrant.
These are injected as few-shot examples into the Gemini prompt in copy_drafter.py.

This is how Project Signal learns the user's tone over time:
  - Initially: Gemini drafts from the system instructions alone
  - After 10+ approved sends: Gemini sees the user's actual writing style in context
  - After 50+ sends: Drafts require minimal editing — the AI has learned the user's voice
"""

from __future__ import annotations

from typing import Optional

from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue

from config.settings import settings
from src.rlhf.embedder import embed_text
from src.utils.logger import get_logger

logger = get_logger(__name__)


def _get_qdrant_client() -> QdrantClient:
    return QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)


async def retrieve_few_shot_examples(
    signal_type: str,
    query_text: str = "",
    top_k: int = 3,
) -> list[str]:
    """
    Query Qdrant for the most similar past nurture emails by signal type.

    Args:
        signal_type: "MACRO" or "MICRO" — filters for same category
        query_text: Optional reference text to search against (uses signal_summary if provided)
        top_k: Number of similar examples to retrieve

    Returns:
        List of human-written email texts (few-shot examples for Gemini prompt).
    """
    client = _get_qdrant_client()

    # Check if collection has any vectors
    try:
        collection_info = client.get_collection(settings.qdrant_collection)
        if collection_info.vectors_count == 0:
            logger.debug("Qdrant collection is empty — skipping RAG retrieval.")
            return []
    except Exception:
        logger.debug("Qdrant collection not found — RAG retrieval skipped.")
        return []

    # Use a generic query if no specific text provided
    search_text = query_text or f"{signal_type} business signal nurture email"
    query_vector = embed_text(search_text)

    try:
        filter_condition = Filter(
            must=[
                FieldCondition(
                    key="signal_type",
                    match=MatchValue(value=signal_type),
                )
            ]
        )

        results = client.search(
            collection_name=settings.qdrant_collection,
            query_vector=query_vector,
            query_filter=filter_condition,
            limit=top_k,
            with_payload=True,
        )

        examples = [
            r.payload.get("text", "") for r in results if r.payload.get("text")
        ]

        logger.debug(f"📚 Retrieved {len(examples)} RAG examples for signal_type={signal_type}")
        return examples

    except Exception as e:
        logger.warning(f"RAG retrieval failed (non-fatal): {e}")
        return []
