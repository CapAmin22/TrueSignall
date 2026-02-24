# ADR-004 — DuckDuckGo OSINT Over Apollo/Hunter/LinkedIn APIs

**Status:** Accepted  
**Date:** February 2026

---

## Context

Prospect and decision-maker data needs to be collected at scale. The obvious tools (Apollo, Hunter, LinkedIn Sales Navigator) cost $50–$1,200/month.

## Decision

Use **DuckDuckGo search dorks** for all OSINT — zero API cost, no rate-limit keys required.

Example dork patterns used in the codebase:

```python
# Decision-maker mapping (decision_maker_mapper.py)
f'site:linkedin.com/in "{company_name}" (VP OR "Vice President" OR CMO OR CRO OR "Head of")'

# Signal detection (signal_detector.py)
f'"{person_name}" (promoted OR "new role" OR "joined" OR "excited to announce")'

# Competitor research (icp_generator.py)
f'"{company_name}" competitors alternatives "{target_market}"'
```

## Consequences

**Positive:**
- Zero cost
- No API keys to manage or rotate
- Results are public data — inherently GDPR-compliant (no scraping behind auth)

**Negative:**
- DuckDuckGo has soft rate limits — mitigated by 0.8–1.5s random delays
- Results less structured than Apollo's API — requires Gemini to parse/extract
- No email discovery (replaced by `email_verifier.py` SMTP pattern-matching)
