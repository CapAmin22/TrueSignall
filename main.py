#!/usr/bin/env python3
"""
Project Signal — CLI Entry Point
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Autonomous B2B Relationship Nurturing & Signal Intelligence Platform.

Usage:
    python main.py --url https://yourcompany.com
    python main.py --url https://yourcompany.com --skip-competitors

Pipeline Stages:
    1. URL Ingestion       → Scrape site → Extract USPs via Gemini
    2. ICP Generation      → Build Target Account List + Decision-Maker Map
    3. HITL Checkpoint     → User reviews/approves the prospect list
    4. Competitor Matrix   → Tri-tier categorization + Battlecard generation
    5. Signal Monitoring   → Handled by workers/signal_worker.py (Oracle VM)
"""

import argparse
import asyncio
import sys

from config.settings import settings
from src.utils.logger import get_logger
from src.utils.database import init_db, get_supabase_client
from src.ingestion.scraper import scrape_brand_info
from src.ingestion.usp_extractor import extract_usps_and_positioning
from src.intelligence.icp_generator import generate_target_account_list
from src.intelligence.decision_maker_mapper import map_decision_makers
from src.competitors.matrix_builder import build_competitor_matrix
from src.competitors.battlecard_generator import generate_battlecards

logger = get_logger(__name__)


async def run_pipeline(url: str, skip_competitors: bool = False) -> None:
    """
    Main orchestration pipeline for Project Signal onboarding.

    This runs once per company onboarding. Daily signal monitoring is
    handled by workers/signal_worker.py running on the Oracle Cloud VM.
    """
    logger.info("🚀 Project Signal pipeline starting", extra={"url": url})

    # ── Stage 1: URL Ingestion ────────────────────────────────────────────────
    logger.info("📡 Stage 1/4 — Ingesting company URL...")
    raw_content = await scrape_brand_info(url)
    market_data = await extract_usps_and_positioning(raw_content, url)
    logger.info("✅ USP extraction complete", extra={"usps": len(market_data.get("usps", []))})

    # ── Stage 2: ICP & Decision-Maker Generation ──────────────────────────────
    logger.info("🎯 Stage 2/4 — Generating Target Account List...")
    target_accounts = await generate_target_account_list(market_data)
    logger.info(f"✅ Found {len(target_accounts)} potential accounts")

    logger.info("👤 Mapping decision-makers for each account...")
    accounts_with_dms = await map_decision_makers(target_accounts, market_data)
    logger.info("✅ Decision-maker mapping complete")

    # ── HITL Checkpoint #1 ─────────────────────────────────────────────────────
    # The Vercel dashboard handles the actual UI interaction via Supabase WebSocket.
    # This CLI signals the system to pause and wait for user approval.
    db = get_supabase_client()
    db.table("companies").upsert({
        "domain": url,
        "system_status": "PENDING_REVIEW",
        "extracted_market_data": market_data,
    }).execute()
    logger.info("⏸  HITL Checkpoint #1: Prospect list sent to dashboard for approval.")
    logger.info("   → Open the Nurturing Dashboard to review and approve accounts.")

    if skip_competitors:
        logger.info("⏭  Skipping competitor matrix (--skip-competitors flag set).")
        return

    # ── Stage 3: Competitor Matrix ─────────────────────────────────────────────
    logger.info("🛡  Stage 3/4 — Building Defensive Matrix...")
    competitor_matrix = await build_competitor_matrix(market_data, url)
    logger.info(
        "✅ Competitor matrix built",
        extra={
            "direct": len([c for c in competitor_matrix if c["threat_level"] == "DIRECT"]),
            "adjacent": len([c for c in competitor_matrix if c["threat_level"] == "ADJACENT"]),
            "indirect": len([c for c in competitor_matrix if c["threat_level"] == "INDIRECT"]),
        },
    )

    logger.info("⚔️  Stage 4/4 — Generating competitive battlecards...")
    await generate_battlecards(competitor_matrix)
    logger.info("✅ Battlecards generated and stored.")

    logger.info("━" * 60)
    logger.info("✅ Project Signal onboarding pipeline complete!")
    logger.info("   → Deploy workers/ on your Oracle VM to start signal monitoring.")
    logger.info("━" * 60)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="signal",
        description="Project Signal — B2B Relationship Nurturing Platform",
    )
    parser.add_argument(
        "--url",
        required=True,
        type=str,
        help="Your company's website URL (e.g. https://yourcompany.com)",
    )
    parser.add_argument(
        "--skip-competitors",
        action="store_true",
        default=False,
        help="Skip the Defensive Matrix stage (useful for testing ingestion only)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    try:
        asyncio.run(run_pipeline(url=args.url, skip_competitors=args.skip_competitors))
    except KeyboardInterrupt:
        logger.info("Pipeline interrupted by user.")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal pipeline error: {e}", exc_info=True)
        sys.exit(1)
