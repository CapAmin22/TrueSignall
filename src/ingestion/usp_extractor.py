"""
src/ingestion/usp_extractor.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gemini-powered extractor: raw scraped HTML → structured market data.
Produces the `extracted_market_data` JSONB payload stored on the companies table.
"""

from __future__ import annotations

import json
from typing import Any

import google.generativeai as genai

from config.settings import settings
from src.utils.logger import get_logger
from src.utils.rate_limiter import RateLimiter

logger = get_logger(__name__)

genai.configure(api_key=settings.gemini_api_key)
_model = genai.GenerativeModel(settings.gemini_model)
_rate_limiter = RateLimiter(rpm=settings.gemini_rpm_limit)

_EXTRACTION_PROMPT = """
You are a senior B2B market analyst. Analyze the following company website content and extract structured market intelligence.

Return ONLY a valid JSON object — no markdown, no explanation, no code fences.

Required JSON structure:
{{
  "company_name": "string",
  "usps": ["string", ...],           // 3-7 unique selling propositions
  "services": ["string", ...],       // specific services/products offered
  "pricing_model": "string",         // e.g. "SaaS subscription", "project-based", "freemium"
  "target_audience": "string",       // who they serve (e.g. "B2B SaaS companies with 50-500 employees")
  "industry_vertical": "string",     // primary industry
  "geographic_focus": "string",      // markets served
  "decision_makers": []              // leave empty — populated by decision_maker_mapper.py
}}

Company Website URL: {url}
Company Website Content:
---
{content}
---
"""


async def extract_usps_and_positioning(
    scraped_data: dict[str, str],
    url: str,
) -> dict[str, Any]:
    """
    Call Gemini to extract structured market data from scraped website content.

    Args:
        scraped_data: Output from scraper.py (must contain "text_content" key).
        url: The company URL (included in prompt for context).

    Returns:
        Parsed JSONB dict ready for Supabase insertion.
    """
    _rate_limiter.wait()

    prompt = _EXTRACTION_PROMPT.format(
        url=url,
        content=scraped_data.get("text_content", "")[:6_000],
    )

    logger.info("🤖 Extracting USPs via Gemini...")

    try:
        response = _model.generate_content(prompt)
        raw_text = response.text.strip()

        # Strip accidental markdown fences
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]

        market_data: dict[str, Any] = json.loads(raw_text)
        market_data["decision_makers"] = []  # Initialize empty — mapper fills this

        logger.info(
            "✅ USP extraction complete",
            extra={"usps": len(market_data.get("usps", [])), "company": market_data.get("company_name")},
        )
        return market_data

    except json.JSONDecodeError as e:
        logger.error(f"Gemini returned invalid JSON: {e}\nRaw: {raw_text[:500]}")
        raise ValueError(f"Gemini extraction failed — invalid JSON response: {e}") from e
    except Exception as e:
        logger.error(f"USP extraction error: {e}", exc_info=True)
        raise
