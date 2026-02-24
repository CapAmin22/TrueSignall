"""
src/rlhf/embedder.py
━━━━━━━━━━━━━━━━━━━━
Converts human-approved nurture email text into vector embeddings.
Uses sentence-transformers/all-MiniLM-L6-v2 — runs locally on Oracle VM.
No external embedding API call needed — 100% free.

Part of the RLHF (Reinforcement Learning from Human Feedback) vector loop:
  1. Human writes/edits the nurture message → stored in signals.human_edited_text
  2. This module embeds it → vector pushed to Qdrant Cloud
  3. Next drafting session retrieves similar past examples via RAG
  4. AI learns the user's specific tone over time
"""

from __future__ import annotations

from sentence_transformers import SentenceTransformer

from src.utils.logger import get_logger

logger = get_logger(__name__)

# Loaded once at module import — ~80MB on first run, cached after
_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    """Lazy-load the embedding model (avoids loading on import if not needed)."""
    global _model
    if _model is None:
        logger.info(f"📦 Loading embedding model: {_MODEL_NAME}")
        _model = SentenceTransformer(_MODEL_NAME)
        logger.info("✅ Embedding model loaded")
    return _model


def embed_text(text: str) -> list[float]:
    """
    Embed a single text string into a 384-dimensional vector.

    Args:
        text: The human-approved email text to embed.

    Returns:
        List of 384 floats (the embedding vector).
    """
    model = _get_model()
    vector = model.encode(text, convert_to_tensor=False)
    return vector.tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    """
    Embed multiple texts in a single pass (more efficient than calling embed_text() in a loop).

    Args:
        texts: List of email texts to embed.

    Returns:
        List of embedding vectors (same order as input).
    """
    if not texts:
        return []
    model = _get_model()
    vectors = model.encode(texts, convert_to_tensor=False, batch_size=32, show_progress_bar=False)
    logger.info(f"✅ Embedded {len(texts)} texts")
    return [v.tolist() for v in vectors]
