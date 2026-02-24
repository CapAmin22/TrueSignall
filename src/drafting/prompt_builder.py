"""
src/drafting/prompt_builder.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Constructs the Gemini prompt for nurture copy drafting.
This is the core of the "Supervised Execution" step (Module 4 in PRD).

Architecture contract:
  - The prompt MUST include a <system> instruction explicitly forbidding hard-selling.
  - The prompt MUST inject: USPs, Competitor weaknesses, Signal context, RAG few-shot examples.
  - The draft MUST have status=AWAITING_APPROVAL — never APPROVED_FOR_SEND directly.

Result: Gemini writes a relationship-first note. Human reviews, edits, approves.
"""

from __future__ import annotations

from typing import Any

_SYSTEM_INSTRUCTION = """
You are a world-class B2B relationship strategist writing on behalf of a sales professional.
Your ONLY goal is to build authentic, human rapport — NOT to pitch a product or close a deal.

ABSOLUTE RULES:
1. Never mention the product, service, or company being sold in this message.
2. Write in first-person, warm, and conversational English.
3. Keep the message SHORT — 3 to 5 sentences maximum.
4. Reference the specific signal naturally and empathetically.
5. End with ONE open-ended, low-pressure question to invite a response.
6. Do NOT use buzzwords, corporate jargon, or salesperson language.
7. Do NOT add a subject line — return body text only.
"""

_DRAFT_PROMPT_TEMPLATE = """
{system_instruction}

CONTEXT ABOUT THE SENDER:
- Company USPs: {usps}
- Services: {services}

COMPETITIVE CONTEXT (internal use only — do not reference in the message):
- Key competitor weakness to keep in mind: {competitor_weakness}

SIGNAL TO REFERENCE:
- Decision Maker: {dm_name}, {dm_title} at {company_name}
- What happened: {signal_summary}
- Signal source: {source_url}
- Why this matters (AI rationale): {ai_rationale}

{few_shot_section}

Write the nurture message now. Remember: relationship first, zero pitch.
"""

_FEW_SHOT_TEMPLATE = """
EXAMPLES OF HOW THIS PERSON WRITES (learn from their tone):
{examples}

---
"""


def build_nurture_prompt(
    signal: dict[str, Any],
    market_data: dict[str, Any],
    competitor_context: str,
    company_name: str,
    few_shot_examples: list[str] | None = None,
) -> str:
    """
    Build the complete Gemini prompt for a nurture draft.

    Args:
        signal: Signal row from Supabase (must include signal_summary, source_url, ai_rationale)
        market_data: Extracted market data (USPs, services)
        competitor_context: Key weakness from battlecard (1-2 sentences)
        company_name: Name of the target company
        few_shot_examples: Past human-approved messages from Qdrant RAG (v1.1+)

    Returns:
        Complete formatted prompt string ready for Gemini.
    """
    few_shot_section = ""
    if few_shot_examples:
        examples_text = "\n\n".join(
            f"Example {i+1}:\n{ex}" for i, ex in enumerate(few_shot_examples)
        )
        few_shot_section = _FEW_SHOT_TEMPLATE.format(examples=examples_text)

    prompt = _DRAFT_PROMPT_TEMPLATE.format(
        system_instruction=_SYSTEM_INSTRUCTION,
        usps=", ".join(market_data.get("usps", [])),
        services=", ".join(market_data.get("services", [])),
        competitor_weakness=competitor_context or "Not specified.",
        dm_name=signal.get("decision_maker_name", "the decision-maker"),
        dm_title=signal.get("decision_maker_title", ""),
        company_name=company_name,
        signal_summary=signal.get("signal_summary", ""),
        source_url=signal.get("source_url", ""),
        ai_rationale=signal.get("ai_rationale", ""),
        few_shot_section=few_shot_section,
    )
    return prompt
