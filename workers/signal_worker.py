#!/usr/bin/env python3
"""
workers/signal_worker.py
━━━━━━━━━━━━━━━━━━━━━━━━
Main Oracle VM cron worker. Runs hourly on the OCI ARM instance.
Detects new signals for all ACTIVE companies, enriches them with Gemini rationales,
and writes them to Supabase — triggering WebSocket events to the Vercel dashboard.

Deploy via cron on Oracle VM:
    # Run every hour
    0 * * * * /home/opc/venv/bin/python /home/opc/Prospect_AI_Agent/workers/signal_worker.py >> /var/log/signal_worker.log 2>&1
"""

import asyncio
import sys
import os

# Ensure project root is in path when run as cron
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.utils.logger import get_logger
from src.utils.database import get_active_companies, get_supabase_client, init_db
from src.signals.signal_detector import detect_signals_for_company, write_signals_to_db
from src.signals.signal_card import enrich_signals_batch

logger = get_logger(__name__)


async def run_signal_detection_cycle() -> None:
    """
    Full signal detection cycle for all active companies.
    This function is the core of the hourly cron job.
    """
    logger.info("━" * 50)
    logger.info("🚀 Signal worker starting...")

    # Step 1: Get all ACTIVE companies from Supabase
    companies = get_active_companies()
    if not companies:
        logger.info("No ACTIVE companies found — signal worker exiting.")
        return

    logger.info(f"📋 Processing {len(companies)} active companies")

    total_signals_written = 0

    for company in companies:
        company_id = company["id"]
        domain = company["domain"]
        market_data = company.get("extracted_market_data") or {}
        decision_makers = market_data.get("decision_makers", [])

        try:
            # Step 2: Detect raw signals via OSINT
            raw_signals = await detect_signals_for_company(
                company_id=company_id,
                company_domain=domain,
                decision_makers=decision_makers,
            )

            if not raw_signals:
                logger.info(f"No new signals for {domain}")
                continue

            # Step 3: Enrich with Gemini AI rationales (enforces source URL requirement)
            enriched_signals = await enrich_signals_batch(raw_signals)

            # Step 4: Write to Supabase (triggers WebSocket to Vercel dashboard)
            written = await write_signals_to_db(enriched_signals)
            total_signals_written += written

        except Exception as e:
            logger.error(f"Signal worker failed for {domain}: {e}", exc_info=True)
            continue

    logger.info(f"✅ Signal worker complete — {total_signals_written} total signals written")
    logger.info("━" * 50)


if __name__ == "__main__":
    try:
        init_db()  # Fail fast if Supabase is unreachable
        asyncio.run(run_signal_detection_cycle())
    except Exception as e:
        logger.error(f"Fatal worker error: {e}", exc_info=True)
        sys.exit(1)
