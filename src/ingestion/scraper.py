"""
src/ingestion/scraper.py
━━━━━━━━━━━━━━━━━━━━━━━━
Async Playwright scraper for company website ingestion.
Returns raw text content for USP extraction via Gemini.

Critical note: Run headless=True on Oracle VM. On Vercel edge, do NOT use Playwright
(serverless has no browser). Trigger this from the Oracle VM worker instead.
"""

from __future__ import annotations

import asyncio
from typing import Optional

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

from src.utils.logger import get_logger

logger = get_logger(__name__)

# Max characters to pass to Gemini — avoids token overruns on free tier
MAX_CONTENT_LENGTH = 8_000


async def scrape_brand_info(url: str, timeout_ms: int = 15_000) -> dict[str, str]:
    """
    Scrape a company's website and return structured raw content.

    Args:
        url: The company's public website URL.
        timeout_ms: Navigation timeout in milliseconds.

    Returns:
        dict with keys: "url", "title", "text_content", "raw_html" (truncated)
    """
    logger.info(f"🌐 Scraping: {url}")

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (compatible; ProjectSignal/1.0; "
                    "+https://github.com/CapAmin22/Prospect_AI_Agent)"
                )
            )
            page = await context.new_page()

            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
                await page.wait_for_timeout(2000)  # Allow JS to hydrate
            except PlaywrightTimeout:
                logger.warning(f"Timeout scraping {url} — proceeding with partial content")

            title = await page.title()
            raw_html = await page.content()
            await browser.close()

        # Extract readable text from meaningful HTML elements
        text_content = _extract_text_from_html(raw_html)

        logger.info(
            f"✅ Scraping complete",
            extra={"url": url, "title": title, "text_length": len(text_content)},
        )

        return {
            "url": url,
            "title": title,
            "text_content": text_content[:MAX_CONTENT_LENGTH],
            "raw_html": raw_html[:50_000],  # Store first 50k chars for DB
        }

    except Exception as e:
        logger.error(f"Scraping failed for {url}: {e}", exc_info=True)
        raise


def _extract_text_from_html(html: str) -> str:
    """Extract meaningful text from HTML using BeautifulSoup."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")

    # Remove noise elements
    for tag in soup(["script", "style", "nav", "footer", "noscript", "svg"]):
        tag.decompose()

    # Prioritize high-signal tags
    priority_tags = soup.find_all(["h1", "h2", "h3", "p", "li", "span", "div"])
    texts = []
    for tag in priority_tags:
        text = tag.get_text(separator=" ", strip=True)
        if len(text) > 20:  # Filter empty/junk elements
            texts.append(text)

    return " ".join(texts)
