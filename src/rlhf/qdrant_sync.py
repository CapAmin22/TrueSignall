"""
src/rlhf/qdrant_sync.py
━━━━━━━━━━━━━━━━━━━━━━━
Pushes human-approved email embeddings to Qdrant Cloud.
Called by workers/rlhf_sync_worker.py on a weekly schedule.

Each vector stored in Qdrant includes metadata (payload):
  - signal_type: MACRO or MICRO
  - signal_category: e.g. "Promotion", "Funding"
  - text: the actual human-written message
  - signal_id: Supabase UUID reference
  - sent_at: timestamp

This metadata enables filtered RAG retrieval in rag_retriever.py.
"""

from __future__ import annotations

import uuid
from typing import Any

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    PointStruct,
    VectorParams,
)

from config.settings import settings
from src.rlhf.embedder import embed_batch
from src.utils.logger import get_logger

logger = get_logger(__name__)

VECTOR_DIM = 384  # all-MiniLM-L6-v2 output dimension


def _get_qdrant_client() -> QdrantClient:
    return QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)


def ensure_collection_exists() -> None:
    """Create the Qdrant collection if it doesn't already exist."""
    client = _get_qdrant_client()
    existing = [c.name for c in client.get_collections().collections]
    if settings.qdrant_collection not in existing:
        client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
        )
        logger.info(f"✅ Created Qdrant collection: {settings.qdrant_collection}")
    else:
        logger.debug(f"Qdrant collection '{settings.qdrant_collection}' already exists.")


def push_approved_drafts(approved_signals: list[dict[str, Any]]) -> int:
    """
    Embed and push human-approved nurture emails to Qdrant Cloud.

    Args:
        approved_signals: List of signal rows with human_edited_text populated.

    Returns:
        Number of vectors successfully pushed.
    """
    # Filter to only signals that have human-edited text
    valid = [s for s in approved_signals if s.get("human_edited_text")]
    if not valid:
        logger.info("No new approved drafts to push to Qdrant.")
        return 0

    texts = [s["human_edited_text"] for s in valid]
    vectors = embed_batch(texts)

    ensure_collection_exists()
    client = _get_qdrant_client()

    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={
                "signal_id": s.get("id"),
                "signal_type": s.get("signal_category", "MICRO"),
                "signal_summary": s.get("signal_summary", ""),
                "text": s.get("human_edited_text", ""),
                "sent_at": s.get("sent_at") or "",
            },
        )
        for s, vector in zip(valid, vectors)
    ]

    client.upsert(collection_name=settings.qdrant_collection, points=points)
    logger.info(f"✅ Pushed {len(points)} vectors to Qdrant collection '{settings.qdrant_collection}'")

    return len(points)


def delete_vectors_for_signal(signal_id: str) -> None:
    """
    Hard-delete all Qdrant vectors associated with a specific signal.
    Used for GDPR/CCPA erasure requests alongside Supabase hard_delete_prospect().
    """
    client = _get_qdrant_client()
    from qdrant_client.models import Filter, FieldCondition, MatchValue

    client.delete(
        collection_name=settings.qdrant_collection,
        points_selector=Filter(
            must=[FieldCondition(key="signal_id", match=MatchValue(value=signal_id))]
        ),
    )
    logger.info(f"🗑  Hard-deleted Qdrant vectors for signal_id: {signal_id}")
