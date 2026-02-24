"""
src/signals/signal_card.py
━━━━━━━━━━━━━━━━━━━━━━━━━━
Transparency Card builder. Takes a raw signal and enriches it with an
AI-generated rationale explaining EXACTLY why this signal matters and how to
approach the decision-maker.

This is the trust mechanism at the core of Project Signal's HITL architecture.
Every card that appears on the Nurturing Dashboard MUST have:
  - signal_summary: What happened
  - source_url: Clickable source (non-negotiable)
  - ai_rationale: Plain-text "why act on this now" (non-negotiable)
"""

from __future__ import annotations

import google.generativeai as genai

from config.settings import settings
from src.utils.logger import get_logger
from src.utils.rate_limiter import RateLimiter

logger = get_logger(__name__)

genai.configure(api_key=settings.gemini_api_key)
_model = genai.GenerativeModel(settings.gemini_model)
_rate_limiter = RateLimiter(rpm=settings.gemini_rpm_limit)

_RATIONALE_PROMPT = """
You are an expert B2B relationship strategist. A sales professional is monitoring signals from key decision-makers. Your job is to write a clear, empathetic RATIONALE for why this signal matters and how they should approach it.

RULES:
- Write in plain text. No bullet points, no headers, no markdown.
- Maximum 3 sentences.
- Focus on relationship-building, NOT pitching.
- Explain the emotional context and the optimal timing for outreach.
- NEVER suggest leading with a product pitch.

Signal Category: {category}
Decision Maker: {dm_name} ({dm_title})
Signal Summary: {signal_summary}
Source: {source_url}

Write the rationale now:
"""


async def enrich_signal_with_rationale(signal: dict) -> dict:
    """
    Call Gemini to generate the AI rationale for a raw signal.
    Updates the signal dict in-place and returns it.

    The source_url is validated before calling Gemini — if missing, the signal
    is rejected. Transparency is non-negotiable.
    """
    if not signal.get("source_url"):
        raise ValueError(
            f"Signal missing source_url — rejected. Signal summary: {signal.get('signal_summary', 'N/A')[:100]}"
        )

    _rate_limiter.wait()

    prompt = _RATIONALE_PROMPT.format(
        category=signal.get("signal_category", "UNKNOWN"),
        dm_name=signal.get("decision_maker_name", "Unknown"),
        dm_title=signal.get("decision_maker_title", "Unknown"),
        signal_summary=signal.get("signal_summary", ""),
        source_url=signal.get("source_url", ""),
    )

    try:
        response = _model.generate_content(prompt)
        rationale = response.text.strip()
        signal["ai_rationale"] = rationale
        logger.debug(
            f"✅ Rationale generated for [{signal.get('decision_maker_name')}]",
            extra={"rationale_length": len(rationale)},
        )
    except Exception as e:
        logger.error(f"Rationale generation failed: {e}", exc_info=True)
        signal["ai_rationale"] = (
            "Rationale generation failed. Please review the source link manually before acting."
        )

    return signal


async def enrich_signals_batch(signals: list[dict]) -> list[dict]:
    """
    Enrich a batch of raw signals with AI rationales.
    Applies the Gemini rate limiter between each call.

    Signals missing source_url are skipped and logged.
    """
    enriched = []
    skipped = 0

    for signal in signals:
        try:
            enriched_signal = await enrich_signal_with_rationale(signal)
            enriched.append(enriched_signal)
        except ValueError as e:
            logger.warning(f"Skipping signal (no source URL): {e}")
            skipped += 1

    logger.info(
        f"✅ Signal enrichment complete — {len(enriched)} enriched, {skipped} skipped (no source URL)"
    )
    return enriched
