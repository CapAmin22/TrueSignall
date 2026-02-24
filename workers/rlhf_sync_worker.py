#!/usr/bin/env python3
"""
workers/rlhf_sync_worker.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Weekly RLHF sync worker. Runs on the Oracle VM.
Queries Supabase for SENT signals with human-edited text that haven't been
vectorized yet, embeds them locally, and pushes to Qdrant Cloud.

This closes the Progressive Autonomy feedback loop:
  Human edits AI draft → Signal marked SENT → This worker → Qdrant ← RAG retriever

Deploy via cron on Oracle VM:
    # Run every Sunday at 2 AM
    0 2 * * 0 /home/opc/venv/bin/python /home/opc/Prospect_AI_Agent/workers/rlhf_sync_worker.py >> /var/log/rlhf_sync.log 2>&1
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.utils.logger import get_logger
from src.utils.database import get_sent_signals_since, get_supabase_client, init_db
from src.rlhf.qdrant_sync import push_approved_drafts

logger = get_logger(__name__)

LOOKBACK_DAYS = 7  # Sync signals from the past week


def run_rlhf_sync() -> None:
    """
    Fetch recently sent signals, embed human-edited text, push to Qdrant.
    Update qdrant_vector_id on the signal row to prevent re-syncing.
    """
    logger.info("🔄 RLHF sync worker starting...")

    # Fetch sent signals not yet embedded
    signals = get_sent_signals_since(days_ago=LOOKBACK_DAYS)

    if not signals:
        logger.info("No new sent signals to embed — RLHF sync complete.")
        return

    logger.info(f"📦 Found {len(signals)} signals to embed and push to Qdrant")

    # Push to Qdrant (embed locally → push vectors)
    pushed_count = push_approved_drafts(signals)

    # Mark signals as synced by setting a placeholder qdrant_vector_id
    if pushed_count > 0:
        db = get_supabase_client()
        signal_ids = [s["id"] for s in signals if s.get("human_edited_text")]
        for signal_id in signal_ids:
            db.table("signals").update(
                {"qdrant_vector_id": f"synced_{signal_id[:8]}"}
            ).eq("id", signal_id).execute()

    logger.info(f"✅ RLHF sync complete — {pushed_count} vectors pushed to Qdrant")


if __name__ == "__main__":
    try:
        init_db()
        run_rlhf_sync()
    except Exception as e:
        logger.error(f"Fatal RLHF sync error: {e}", exc_info=True)
        sys.exit(1)
