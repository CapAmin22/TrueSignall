"""
src/drafting/copy_drafter.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Calls Gemini to generate the nurture draft using the structured prompt.
Saves the result to the `signals` table with status=AWAITING_APPROVAL.

Safety lock: The draft CANNOT be marked APPROVED_FOR_SEND from here.
Only the Vercel HITL UI can flip that status field via an authenticated API call.
"""

from __future__ import annotations

from typing import Any

import google.generativeai as genai

from config.settings import settings
from src.drafting.prompt_builder import build_nurture_prompt
from src.rlhf.rag_retriever import retrieve_few_shot_examples
from src.utils.database import get_supabase_client
from src.utils.logger import get_logger
from src.utils.rate_limiter import RateLimiter

logger = get_logger(__name__)

genai.configure(api_key=settings.gemini_api_key)
_model = genai.GenerativeModel(settings.gemini_model)
_rate_limiter = RateLimiter(rpm=settings.gemini_rpm_limit)


async def draft_nurture_message(
    signal: dict[str, Any],
    market_data: dict[str, Any],
    competitor_context: str,
    company_name: str,
) -> str:
    """
    Generate a relationship-first nurture message for a given signal.
    Saves the draft to Supabase with status=AWAITING_APPROVAL.

    Args:
        signal: Full signal row from Supabase (must include signal_summary, rationale)
        market_data: Extracted USPs and services from the user's company
        competitor_context: Relevant competitor weakness context
        company_name: Name of the target decision-maker's company

    Returns:
        The generated draft text.
    """
    signal_id = signal.get("id")
    logger.info(f"✍️  Drafting nurture message for signal {signal_id}")

    # ── Retrieve RAG few-shot examples (if Qdrant has data) ──────────────────
    few_shot_examples: list[str] = []
    try:
        few_shot_examples = await retrieve_few_shot_examples(
            signal_type=signal.get("signal_category", "MICRO"),
            top_k=3,
        )
    except Exception as e:
        logger.debug(f"RAG retrieval skipped (non-fatal): {e}")

    # ── Build prompt & call Gemini ────────────────────────────────────────────
    prompt = build_nurture_prompt(
        signal=signal,
        market_data=market_data,
        competitor_context=competitor_context,
        company_name=company_name,
        few_shot_examples=few_shot_examples or None,
    )

    _rate_limiter.wait()

    try:
        response = _model.generate_content(prompt)
        draft_text = response.text.strip()
    except Exception as e:
        logger.error(f"Gemini drafting failed for signal {signal_id}: {e}", exc_info=True)
        raise

    # ── Write draft to DB — status stays AWAITING_APPROVAL (HITL required) ───
    if signal_id:
        db = get_supabase_client()
        db.table("signals").update(
            {
                "ai_draft": draft_text,
                "status": "AWAITING_APPROVAL",
            }
        ).eq("id", signal_id).execute()
        logger.info(f"✅ Draft saved for signal {signal_id} — status: AWAITING_APPROVAL")

    return draft_text
