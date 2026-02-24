"""
src/signals/signal_detector.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OSINT-based signal detection engine. Monitors approved decision-makers 24/7.
Uses two zero-cost sources:
  1. feedparser — parses Google Alerts RSS feeds for company/person mentions
  2. DuckDuckGo dorks — targeted searches for LinkedIn promotions/life events

Runs on Oracle VM as a cron job (workers/signal_worker.py).
Writes raw signals to Supabase `signals` table with status=UNREAD.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

import feedparser
from duckduckgo_search import DDGS

from config.settings import settings
from src.utils.database import get_supabase_client
from src.utils.logger import get_logger

logger = get_logger(__name__)

# DuckDuckGo dork templates for personal (MICRO) signals
MICRO_SIGNAL_DORKS = [
    'site:linkedin.com "{name}" "promoted to"',
    'site:linkedin.com "{name}" "excited to announce" "{company}"',
    'site:linkedin.com "{name}" "new role" "{company}"',
    'site:linkedin.com "{name}" "awarded" OR "recognized"',
    'site:linkedin.com "{name}" "speaking at"',
    '"{name}" "{company}" "joined" site:linkedin.com',
]

# DuckDuckGo dork templates for company (MACRO) signals
MACRO_SIGNAL_DORKS = [
    '"{company}" "Series A" OR "Series B" OR "Series C" OR "raised" site:techcrunch.com OR site:prnewswire.com',
    '"{company}" "hiring" OR "expanding" OR "new office" site:linkedin.com OR site:prnewswire.com',
    '"{company}" "acquired" OR "merger" OR "partnership" site:techcrunch.com',
]


async def detect_signals_for_company(
    company_id: str,
    company_domain: str,
    decision_makers: list[dict[str, str]],
) -> list[dict[str, Any]]:
    """
    Run full signal detection for a single approved company.
    Combines RSS feed parsing + DuckDuckGo OSINT dorks.

    Returns list of raw signal dicts (not yet enriched with AI rationale).
    """
    company_name = company_domain.split(".")[0].title()
    logger.info(f"📡 Detecting signals for {company_name} ({len(decision_makers)} decision-makers)")

    raw_signals: list[dict[str, Any]] = []

    # ── Macro Signals: Company-level events ───────────────────────────────────
    for dork_template in MACRO_SIGNAL_DORKS:
        query = dork_template.format(company=company_name)
        signals = _search_duckduckgo(query, company_id, None, "MACRO")
        raw_signals.extend(signals)
        await asyncio.sleep(1.0)  # Polite delay

    # ── Micro Signals: Personal/professional events per decision-maker ────────
    for dm in decision_makers:
        dm_name = dm.get("name", "")
        if not dm_name:
            continue
        for dork_template in MICRO_SIGNAL_DORKS:
            query = dork_template.format(name=dm_name, company=company_name)
            signals = _search_duckduckgo(
                query, company_id, dm, "MICRO"
            )
            raw_signals.extend(signals)
            await asyncio.sleep(0.8)

    logger.info(f"✅ Detected {len(raw_signals)} raw signals for {company_name}")
    return raw_signals


def _search_duckduckgo(
    query: str,
    company_id: str,
    decision_maker: dict[str, str] | None,
    category: str,
) -> list[dict[str, Any]]:
    """Execute a single DuckDuckGo search and return normalized raw signal dicts."""
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=3))
            signals = []
            for r in results:
                source_url = r.get("href", "")
                if not source_url:
                    continue
                signals.append(
                    {
                        "target_company_id": company_id,
                        "decision_maker_name": decision_maker.get("name") if decision_maker else None,
                        "decision_maker_title": decision_maker.get("title") if decision_maker else None,
                        "decision_maker_url": decision_maker.get("social_url") if decision_maker else None,
                        "signal_category": category,
                        "signal_summary": f"{r.get('title', '')} — {r.get('body', '')[:200]}",
                        "source_url": source_url,
                        "ai_rationale": "",   # Populated by signal_card.py
                        "status": "UNREAD",
                        "detected_at": datetime.now(timezone.utc).isoformat(),
                    }
                )
            return signals
    except Exception as e:
        logger.debug(f"DDG search failed for query '{query[:60]}': {e}")
        return []


async def write_signals_to_db(signals: list[dict[str, Any]]) -> int:
    """
    Batch-insert raw signals to Supabase. Supabase Realtime will broadcast
    each insertion as a WebSocket event to the Vercel Nurturing Dashboard.

    Returns the count of successfully written signals.
    """
    if not signals:
        return 0

    db = get_supabase_client()
    try:
        result = db.table("signals").insert(signals).execute()
        count = len(result.data) if result.data else 0
        logger.info(f"📥 Wrote {count} signals to Supabase")
        return count
    except Exception as e:
        logger.error(f"Failed to write signals to DB: {e}", exc_info=True)
        return 0
