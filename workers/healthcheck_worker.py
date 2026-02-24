#!/usr/bin/env python3
"""
workers/healthcheck_worker.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Supabase keep-alive worker. Runs twice per week on the Oracle VM.
Executes a lightweight SELECT 1 query to prevent the Supabase free-tier
instance from pausing after 7 days of inactivity.

Critical: Supabase free-tier auto-pauses after 7 days of no activity.
This worker runs Mon/Thu at midnight to guarantee the DB stays awake.

Deploy via cron on Oracle VM:
    # Run Monday and Thursday at midnight
    0 0 * * 1,4 /home/opc/venv/bin/python /home/opc/Prospect_AI_Agent/workers/healthcheck_worker.py >> /var/log/healthcheck.log 2>&1
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.utils.logger import get_logger

logger = get_logger(__name__)


def ping_supabase() -> bool:
    """
    Execute a lightweight SELECT 1 to keep Supabase awake.
    Returns True on success, False on failure.
    """
    from src.utils.database import get_supabase_client

    db = get_supabase_client()
    try:
        # Minimal query — just check the companies table count
        result = db.table("companies").select("id", count="exact").limit(1).execute()
        logger.info(
            "✅ Supabase healthcheck passed",
            extra={"companies_count": result.count},
        )
        return True
    except Exception as e:
        logger.error(f"❌ Supabase healthcheck FAILED: {e}", exc_info=True)
        return False


if __name__ == "__main__":
    success = ping_supabase()
    sys.exit(0 if success else 1)
