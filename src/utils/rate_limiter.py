"""
src/utils/rate_limiter.py
━━━━━━━━━━━━━━━━━━━━━━━━━
Token-bucket rate limiter for Gemini API calls.
Enforces the free-tier 15 RPM cap to prevent HTTP 429 errors.

Critical deployment note from PRD:
  "Generating rationales and copy for 100 signals will crash the system with
   HTTP 429 errors. We must implement a simple time.sleep(4.1) between calls."

This module implements that requirement in a reusable, thread-safe class.
"""

from __future__ import annotations

import time
import threading

from src.utils.logger import get_logger

logger = get_logger(__name__)


class RateLimiter:
    """
    Simple time-based rate limiter that enforces a minimum interval between calls.
    Thread-safe for Oracle VM workers.

    Usage:
        limiter = RateLimiter(rpm=15)
        limiter.wait()  # Call before every Gemini API call
        response = model.generate_content(prompt)
    """

    def __init__(self, rpm: int = 15):
        """
        Args:
            rpm: Maximum requests per minute allowed.
        """
        self._min_interval: float = 60.0 / rpm + 0.1  # +0.1s safety buffer
        self._last_call_time: float = 0.0
        self._lock = threading.Lock()

        logger.debug(
            f"RateLimiter initialized: {rpm} RPM → min interval {self._min_interval:.2f}s"
        )

    def wait(self) -> None:
        """
        Block until it is safe to make the next API call.
        Records the call timestamp after unblocking.
        """
        with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_call_time
            sleep_for = self._min_interval - elapsed

            if sleep_for > 0:
                logger.debug(f"⏳ Rate limiter: sleeping {sleep_for:.2f}s (Gemini RPM guard)")
                time.sleep(sleep_for)

            self._last_call_time = time.monotonic()
