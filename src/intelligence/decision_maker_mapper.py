"""
src/intelligence/decision_maker_mapper.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Maps specific budget-owning decision-makers to each target account.
Uses DuckDuckGo OSINT dorks targeting LinkedIn profiles — zero-cost, no API key required.

Key insight: We search for the *role*, not a generic HR contact.
e.g., "VP of Growth" at "Acme Corp" site:linkedin.com/in/
"""

from __future__ import annotations

import asyncio
from typing import Any

from duckduckgo_search import DDGS

from src.utils.logger import get_logger

logger = get_logger(__name__)

# Roles most likely to have purchasing power for common B2B services
DECISION_MAKER_ROLES = [
    "VP of Growth",
    "VP of Sales",
    "Chief Marketing Officer",
    "CMO",
    "Head of Revenue",
    "Director of Marketing",
    "VP of Marketing",
    "Chief Revenue Officer",
    "CRO",
    "Head of Sales",
    "Director of Business Development",
]


async def map_decision_makers(
    target_accounts: list[dict[str, Any]],
    market_data: dict[str, Any],
    max_per_company: int = 3,
) -> list[dict[str, Any]]:
    """
    For each target account, find decision-makers via LinkedIn OSINT dorks.

    Args:
        target_accounts: Output from icp_generator.py
        market_data: Used to refine role targeting based on service type
        max_per_company: Max decision-maker profiles to surface per company

    Returns:
        target_accounts list enriched with "decision_makers" key on each entry.
    """
    logger.info(f"👤 Mapping decision-makers for {len(target_accounts)} accounts...")

    enriched_accounts = []
    for account in target_accounts:
        company_name = account.get("company_name", "")
        dms = await _find_decision_makers_for_company(company_name, max_per_company)
        account["decision_makers"] = dms
        enriched_accounts.append(account)

        # Polite delay between accounts to avoid DDG rate limiting
        await asyncio.sleep(1.5)

    total_dms = sum(len(a.get("decision_makers", [])) for a in enriched_accounts)
    logger.info(f"✅ Decision-maker mapping complete — {total_dms} profiles found")
    return enriched_accounts


async def _find_decision_makers_for_company(
    company_name: str,
    max_results: int,
) -> list[dict[str, str]]:
    """
    Execute DuckDuckGo dork searches to surface LinkedIn profiles of decision-makers.
    """
    decision_makers = []

    for role in DECISION_MAKER_ROLES[:5]:  # Top 5 roles per company
        query = f'site:linkedin.com/in/ "{role}" "{company_name}"'
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=2))
                for r in results:
                    href = r.get("href", "")
                    title = r.get("title", "")
                    if "linkedin.com/in/" in href and company_name.lower()[:5] in title.lower():
                        # Extract name from LinkedIn profile title (format: "Name - Role at Company")
                        name = title.split(" - ")[0].strip() if " - " in title else title
                        decision_makers.append(
                            {
                                "name": name,
                                "title": role,
                                "social_url": href,
                                "email": None,  # Populated by enrichment/email_verifier.py
                            }
                        )
                        if len(decision_makers) >= max_results:
                            return decision_makers
        except Exception as e:
            logger.debug(f"DDG dork failed for {role} @ {company_name}: {e}")
            continue

    return decision_makers
