"""
src/competitors/battlecard_generator.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Scrapes G2 and Capterra review pages for DIRECT and INDIRECT competitors.
Extracts recurring weakness themes via Gemini — turns user complaints into
competitive positioning ammo for nurture copy drafts.

Zero-cost: No G2/Capterra API needed — we scrape the public search results.
"""

from __future__ import annotations

from typing import Any

import google.generativeai as genai
from duckduckgo_search import DDGS

from config.settings import settings
from src.utils.database import get_supabase_client
from src.utils.logger import get_logger
from src.utils.rate_limiter import RateLimiter

logger = get_logger(__name__)

genai.configure(api_key=settings.gemini_api_key)
_model = genai.GenerativeModel(settings.gemini_model)
_rate_limiter = RateLimiter(rpm=settings.gemini_rpm_limit)

_WEAKNESS_PROMPT = """
You are analyzing customer reviews of a competitor product. Extract the TOP 3 recurring weaknesses or complaints customers report.

Review snippets:
{review_snippets}

Return a single plain-text paragraph (no bullet points, no markdown) summarizing the 3 main pain points that real customers experience with this product. Maximum 100 words.
"""


async def generate_battlecards(competitor_matrix: list[dict[str, Any]]) -> None:
    """
    For each DIRECT and INDIRECT competitor, scrape review sites and
    generate a weakness summary. Saves to the `competitors` Supabase table.

    Args:
        competitor_matrix: Output from matrix_builder.build_competitor_matrix()
    """
    targets = [
        c for c in competitor_matrix
        if c.get("threat_level") in ("DIRECT", "INDIRECT")
    ]

    logger.info(f"⚔️  Generating battlecards for {len(targets)} competitors...")

    db = get_supabase_client()

    for comp in targets:
        name = comp.get("competitor_name", "")
        domain = comp.get("competitor_domain", "")

        review_snippets = await _scrape_reviews(name)
        if not review_snippets:
            logger.debug(f"No reviews found for {name} — skipping battlecard.")
            continue

        _rate_limiter.wait()

        prompt = _WEAKNESS_PROMPT.format(review_snippets=review_snippets[:3_000])
        try:
            response = _model.generate_content(prompt)
            weakness_context = response.text.strip()

            # Store in Supabase competitors table
            db.table("competitors").upsert(
                {
                    "competitor_domain": domain,
                    "competitor_name": name,
                    "threat_level": comp.get("threat_level"),
                    "weakness_context": weakness_context,
                    "positioning_notes": comp.get("positioning_notes", ""),
                },
                on_conflict="competitor_domain",
            ).execute()

            logger.info(f"✅ Battlecard saved for {name}")
        except Exception as e:
            logger.error(f"Battlecard generation failed for {name}: {e}", exc_info=True)


async def _scrape_reviews(competitor_name: str) -> str:
    """Use DuckDuckGo to find G2/Capterra review snippets for a competitor."""
    query = f'"{competitor_name}" reviews site:g2.com OR site:capterra.com "cons" OR "problems" OR "missing"'
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5))
            snippets = "\n".join(
                f"- {r.get('title', '')}: {r.get('body', '')[:250]}" for r in results
            )
            return snippets
    except Exception as e:
        logger.debug(f"Review scrape failed for {competitor_name}: {e}")
        return ""
