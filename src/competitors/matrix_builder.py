"""
src/competitors/matrix_builder.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tri-tier Defensive Matrix builder.
Categorizes all identified market players into DIRECT / ADJACENT / INDIRECT.

DIRECT   → Exact product match → Auto-blocklisted (never contacted)
ADJACENT → Same audience, different problem → Flagged as potential partner
INDIRECT → Same problem, different method → Monitored for intelligence

Architecture Note: DIRECT competitor domains are written to the companies table
with system_status='BLOCKED'. The signal_detector.py will never scan a BLOCKED company.
"""

from __future__ import annotations

import json
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

_MATRIX_PROMPT = """
You are a competitive intelligence analyst. Based on the company profile below, identify and categorize competitors into a tri-tier matrix.

Company Profile:
- USPs: {usps}
- Services: {services}
- Target Audience: {target_audience}
- Industry: {industry}

Market Players Found via Search:
{search_results}

Categorize each company into exactly one of:
- DIRECT: Exact same product/service, same audience, same problem. Must be blocked from outreach.
- ADJACENT: Same target audience, different problem. Potential integration/partner opportunity.
- INDIRECT: Same problem, completely different methodology or delivery model.

Return ONLY a valid JSON array — no markdown, no explanation:
[
  {{
    "competitor_name": "string",
    "competitor_domain": "string",
    "threat_level": "DIRECT" | "ADJACENT" | "INDIRECT",
    "positioning_notes": "string"   // one sentence on how user's USPs counter or complement this player
  }},
  ...
]
"""


async def build_competitor_matrix(
    market_data: dict[str, Any],
    user_domain: str,
) -> list[dict[str, Any]]:
    """
    Build the Defensive Matrix for a company's market space.

    Args:
        market_data: Extracted from usp_extractor.py
        user_domain: The user's own domain (excluded from results)

    Returns:
        List of categorized competitor dicts.
    """
    industry = market_data.get("industry_vertical", "")
    audience = market_data.get("target_audience", "")
    services = ", ".join(market_data.get("services", []))

    # Search for market players
    query = f'"{industry}" "{audience}" tools OR platforms OR software OR agencies'
    logger.info(f"🛡  Searching for competitors: {query[:80]}")

    search_results_text = ""
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=settings.duckduckgo_max_results))
            search_results_text = "\n".join(
                f"- {r.get('title', '')} | {r.get('href', '')}" for r in results
            )
    except Exception as e:
        logger.warning(f"Competitor search failed (non-fatal): {e}")

    _rate_limiter.wait()

    prompt = _MATRIX_PROMPT.format(
        usps=", ".join(market_data.get("usps", [])),
        services=services,
        target_audience=audience,
        industry=industry,
        search_results=search_results_text[:4_000] or "No search results.",
    )

    logger.info("🤖 Categorizing competitor matrix via Gemini...")

    try:
        response = _model.generate_content(prompt)
        raw = response.text.strip().lstrip("```json").lstrip("```").rstrip("```")
        competitors: list[dict] = json.loads(raw)

        # Exclude user's own domain from results
        competitors = [c for c in competitors if user_domain not in c.get("competitor_domain", "")]

        await _enforce_blocklist(competitors)
        logger.info(
            "✅ Competitor matrix built",
            extra={
                "direct": sum(1 for c in competitors if c["threat_level"] == "DIRECT"),
                "adjacent": sum(1 for c in competitors if c["threat_level"] == "ADJACENT"),
                "indirect": sum(1 for c in competitors if c["threat_level"] == "INDIRECT"),
            },
        )
        return competitors

    except json.JSONDecodeError as e:
        logger.error(f"Competitor matrix returned invalid JSON: {e}")
        return []


async def _enforce_blocklist(competitors: list[dict]) -> None:
    """
    Auto-blocklist all DIRECT competitors in the companies table.
    Prevents signal_detector.py from ever scanning them.
    """
    db = get_supabase_client()
    direct_competitors = [c for c in competitors if c.get("threat_level") == "DIRECT"]

    for comp in direct_competitors:
        domain = comp.get("competitor_domain", "")
        if not domain:
            continue
        try:
            db.table("companies").upsert(
                {"domain": domain, "system_status": "BLOCKED"},
                on_conflict="domain",
            ).execute()
            logger.info(f"🚫 Auto-blocklisted direct competitor: {domain}")
        except Exception as e:
            logger.warning(f"Failed to blocklist {domain}: {e}")
