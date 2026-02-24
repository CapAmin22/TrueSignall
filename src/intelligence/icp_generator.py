"""
src/intelligence/icp_generator.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generates the exhaustive Target Account List (TAL) from extracted market data.
Uses DuckDuckGo search + Gemini reasoning to identify ICP-matching companies.

Goal: Maximum lead yield — produce the longest, most comprehensive verified list possible.
"""

from __future__ import annotations

import json
from typing import Any

import google.generativeai as genai
from duckduckgo_search import DDGS

from config.settings import settings
from src.utils.logger import get_logger
from src.utils.rate_limiter import RateLimiter

logger = get_logger(__name__)

genai.configure(api_key=settings.gemini_api_key)
_model = genai.GenerativeModel(settings.gemini_model)
_rate_limiter = RateLimiter(rpm=settings.gemini_rpm_limit)

_ICP_PROMPT = """
You are a B2B growth strategist. Based on the company profile below, generate an exhaustive list of companies that would be ideal customers.

Company Profile:
- USPs: {usps}
- Services: {services}
- Target Audience: {target_audience}
- Industry Vertical: {industry_vertical}

Web Search Results (additional context):
{search_results}

Generate a JSON array of target companies. Return ONLY valid JSON — no markdown, no explanation.

Required format:
[
  {{
    "company_name": "string",
    "domain": "string",              // best guess domain, e.g. "acme.com"
    "industry": "string",
    "estimated_size": "string",      // e.g. "50-200 employees"
    "icp_fit_reason": "string"       // one sentence explaining the fit
  }},
  ...
]

Generate at least 20 highly specific, real companies. Prioritize precision over recall.
"""


async def generate_target_account_list(
    market_data: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    Build the Target Account List from the extracted ICP profile.

    Args:
        market_data: Output from usp_extractor.py

    Returns:
        List of target company dicts with domain, industry, size, fit reason.
    """
    target_audience = market_data.get("target_audience", "")
    industry = market_data.get("industry_vertical", "")

    # ── Step 1: OSINT Search for Context ──────────────────────────────────────
    search_query = f'"{target_audience}" "{industry}" companies site:linkedin.com OR site:crunchbase.com'
    logger.info(f"🔍 Running ICP search: {search_query[:80]}...")

    search_results_text = ""
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(search_query, max_results=settings.duckduckgo_max_results))
            search_results_text = "\n".join(
                f"- {r.get('title', '')}: {r.get('href', '')}" for r in results
            )
    except Exception as e:
        logger.warning(f"DuckDuckGo search failed (non-fatal): {e}")

    # ── Step 2: Gemini ICP Generation ─────────────────────────────────────────
    _rate_limiter.wait()

    prompt = _ICP_PROMPT.format(
        usps=", ".join(market_data.get("usps", [])),
        services=", ".join(market_data.get("services", [])),
        target_audience=target_audience,
        industry_vertical=industry,
        search_results=search_results_text[:3_000] or "No search results available.",
    )

    logger.info("🤖 Generating Target Account List via Gemini...")

    try:
        response = _model.generate_content(prompt)
        raw = response.text.strip().lstrip("```json").lstrip("```").rstrip("```")
        accounts: list[dict[str, Any]] = json.loads(raw)
        logger.info(f"✅ Generated {len(accounts)} target accounts")
        return accounts

    except json.JSONDecodeError as e:
        logger.error(f"ICP generation returned invalid JSON: {e}")
        return []
    except Exception as e:
        logger.error(f"ICP generation failed: {e}", exc_info=True)
        raise
