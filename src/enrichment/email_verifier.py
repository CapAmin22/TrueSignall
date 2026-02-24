"""
src/enrichment/email_verifier.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Zero-cost email verification via SMTP handshake.
Bypasses Apollo.io / Hunter.io by directly pinging the domain's mail server.

CRITICAL: This MUST run on the Oracle Cloud VM.
- Port 25 is blocked on Vercel (serverless) and residential IPs.
- Running from OCI ARM instance with an elastic IP is required.
- Enforces polite rate limits to avoid Spamhaus blacklisting.
"""

from __future__ import annotations

import smtplib
import socket
import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

import dns.resolver

from config.settings import settings
from src.utils.logger import get_logger

logger = get_logger(__name__)

# Track verification counts per domain per hour to prevent IP burnout
_domain_verification_counts: dict[str, list[float]] = defaultdict(list)


def verify_b2b_email(target_email: str) -> tuple[bool, float]:
    """
    Verify whether a B2B email address likely exists via SMTP handshake.
    No email is sent — only the RCPT TO SMTP command is executed.

    Args:
        target_email: The email address to verify (e.g. john.doe@acme.com)

    Returns:
        Tuple of (is_valid: bool, confidence_score: float 0-100)
    """
    domain = target_email.split("@")[-1]

    # ── Rate limit check (max N verifications per domain per hour) ────────────
    if not _check_rate_limit(domain):
        logger.warning(
            f"Rate limit hit for domain {domain} — skipping verification to protect IP reputation"
        )
        return False, 55.0  # Return baseline score, not failure

    try:
        # ── Step 1: Resolve MX record ─────────────────────────────────────────
        records = dns.resolver.resolve(domain, "MX")
        mx_record = str(sorted(records, key=lambda r: r.preference)[0].exchange)
        logger.debug(f"MX record for {domain}: {mx_record}")

        # ── Step 2: SMTP handshake ────────────────────────────────────────────
        server = smtplib.SMTP(timeout=5)
        server.set_debuglevel(0)
        server.connect(mx_record, 25)
        server.helo(settings.sender_domain or "verify.signal-platform.ai")
        server.mail(f"hello@{settings.sender_domain or 'signal-platform.ai'}")

        # ── Step 3: RCPT TO probe ─────────────────────────────────────────────
        # 250 → Valid address exists
        # 550 → User not found on this server
        code, message = server.rcpt(str(target_email))
        server.quit()

        _record_verification(domain)

        if code == 250:
            logger.info(f"✅ SMTP verified: {target_email} (code {code})")
            return True, 90.0
        else:
            logger.debug(f"SMTP rejected: {target_email} (code {code}: {message})")
            return False, 0.0

    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
        logger.debug(f"No MX record for domain {domain}")
        return False, 0.0
    except (socket.timeout, ConnectionRefusedError, smtplib.SMTPConnectError):
        # Server dropped connection — common for privacy-protecting mail servers
        # Return baseline score rather than hard failure per PRD
        return False, 55.0
    except Exception as e:
        logger.debug(f"SMTP verification failed for {target_email}: {e}")
        return False, 0.0


def generate_email_patterns(first: str, last: str, domain: str) -> list[str]:
    """
    Generate 7 common B2B email patterns for a given name and domain.
    Use in conjunction with verify_b2b_email() to find the correct format.
    """
    f, l = first.lower().strip(), last.lower().strip()
    return [
        f"{f}.{l}@{domain}",
        f"{f}{l}@{domain}",
        f"{f[0]}{l}@{domain}",
        f"{f}_{l}@{domain}",
        f"{f}@{domain}",
        f"{f}.{l[0]}@{domain}",
        f"{f}{l[0]}@{domain}",
    ]


def _check_rate_limit(domain: str) -> bool:
    """Return True if we're within the hourly verification limit for this domain."""
    now = time.time()
    hour_ago = now - 3600
    # Prune timestamps older than 1 hour
    _domain_verification_counts[domain] = [
        t for t in _domain_verification_counts[domain] if t > hour_ago
    ]
    return len(_domain_verification_counts[domain]) < settings.smtp_max_verifications_per_hour


def _record_verification(domain: str) -> None:
    """Record a verification attempt for rate limiting."""
    _domain_verification_counts[domain].append(time.time())
