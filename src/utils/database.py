"""
src/utils/database.py
━━━━━━━━━━━━━━━━━━━━━
Supabase client singleton and state machine helper functions.
Replaces the old SQLite-based database.py from v3.0.

All state transitions go through this module to ensure consistency.
The state machine for signals is:
  UNREAD → DRAFTING → AWAITING_APPROVAL → APPROVED_FOR_SEND → SENT | IGNORED
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any, Optional

from supabase import create_client, Client

from config.settings import settings
from src.utils.logger import get_logger

logger = get_logger(__name__)


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    """
    Return the Supabase client singleton.
    Uses the anon key for frontend operations and falls back to service role key for workers.
    """
    key = settings.supabase_service_role_key or settings.supabase_anon_key
    return create_client(settings.supabase_url, key)


def init_db() -> None:
    """
    Verify Supabase connection on startup. Raises on failure.
    Call this in main.py and workers to fail fast if credentials are wrong.
    """
    client = get_supabase_client()
    client.table("companies").select("id").limit(1).execute()
    logger.info("✅ Supabase connection verified")


# ── State Machine Transitions ─────────────────────────────────────────────────

def transition_signal_status(signal_id: str, new_status: str) -> None:
    """
    Safely transition a signal to a new status.
    Validates the transition is legal before writing.
    """
    valid_statuses = {
        "UNREAD", "DRAFTING", "AWAITING_APPROVAL", "APPROVED_FOR_SEND", "SENT", "IGNORED"
    }
    if new_status not in valid_statuses:
        raise ValueError(f"Invalid signal status: {new_status}")

    db = get_supabase_client()
    db.table("signals").update({"status": new_status}).eq("id", signal_id).execute()
    logger.info(f"Signal {signal_id} → {new_status}")


def get_active_companies() -> list[dict[str, Any]]:
    """Return all companies with system_status=ACTIVE."""
    db = get_supabase_client()
    result = db.table("companies").select("*").eq("system_status", "ACTIVE").execute()
    return result.data or []


def get_unread_signals(company_id: Optional[str] = None) -> list[dict[str, Any]]:
    """Return UNREAD signals, optionally filtered by company."""
    db = get_supabase_client()
    query = db.table("signals").select("*").eq("status", "UNREAD")
    if company_id:
        query = query.eq("target_company_id", company_id)
    result = query.order("detected_at", desc=True).execute()
    return result.data or []


def get_sent_signals_since(days_ago: int) -> list[dict[str, Any]]:
    """Return SENT signals with human_edited_text for RLHF sync."""
    from datetime import datetime, timezone, timedelta

    cutoff = (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()
    db = get_supabase_client()
    result = (
        db.table("signals")
        .select("*")
        .eq("status", "SENT")
        .not_.is_("human_edited_text", "null")
        .is_("qdrant_vector_id", "null")  # Not yet synced to Qdrant
        .gte("sent_at", cutoff)
        .execute()
    )
    return result.data or []
