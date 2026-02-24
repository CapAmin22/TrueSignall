"""
src/utils/logger.py
━━━━━━━━━━━━━━━━━━━
Structured JSON logger for Project Signal.
Uses only Python stdlib — no external logging deps.

Output format: JSON lines — easily parseable by log aggregators (OCI Logging, Loki, etc.)
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

from config.settings import settings


class _JsonFormatter(logging.Formatter):
    """Format log records as single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        log_obj: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        # Include extra fields passed via logger.info(..., extra={...})
        for key, value in record.__dict__.items():
            if key not in (
                "name", "msg", "args", "levelname", "levelno", "pathname",
                "filename", "module", "exc_info", "exc_text", "stack_info",
                "lineno", "funcName", "created", "msecs", "relativeCreated",
                "thread", "threadName", "processName", "process", "message",
                "taskName",
            ) and not key.startswith("_"):
                log_obj[key] = value

        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_obj, default=str)


def get_logger(name: str) -> logging.Logger:
    """
    Get a structured JSON logger for the given module name.

    Usage:
        logger = get_logger(__name__)
        logger.info("Signal detected", extra={"signal_id": "abc-123"})
    """
    logger = logging.getLogger(name)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(_JsonFormatter())
        logger.addHandler(handler)
        logger.propagate = False

    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logger.setLevel(level)

    return logger
