# Contributing to Project Signal

Thank you for your interest in contributing! Project Signal is a relationship-first B2B intelligence platform — we hold contributions to the same standard.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/YOUR_USERNAME/Prospect_AI_Agent.git`
3. **Set up** the environment:
   ```bash
   python -m venv venv && venv\Scripts\activate  # Windows
   pip install -r requirements.txt
   playwright install chromium
   cp .env.example .env  # Fill in credentials
   ```

## Branch Naming Convention

| Prefix | Use For |
|---|---|
| `feat/` | New features (e.g. `feat/google-alerts-rss`) |
| `fix/` | Bug fixes (e.g. `fix/gemini-rate-limiter`) |
| `refactor/` | Code improvements without behavior changes |
| `docs/` | Documentation updates |
| `chore/` | Dependency bumps, CI changes |

## Pull Request Checklist

Before opening a PR, confirm:
- [ ] `ruff check src/ workers/ --select E,W,F` passes with zero errors
- [ ] All new signal sources surface a `source_url` — no dark data
- [ ] Any new Gemini calls go through `RateLimiter` (15 RPM guard)
- [ ] No hard-sell language in any prompt template
- [ ] New state transitions update `src/utils/database.py` with the correct status

## Architecture Principles (Non-Negotiable)

These align with the PRD's four core tenets and must be respected in all contributions:

1. **Transparency First** — Every data point returned to the UI must have a `source_url`. PRs that surface data without sources will be rejected.
2. **HITL Supremacy** — No contribution may auto-send external communications. The `AWAITING_APPROVAL → APPROVED_FOR_SEND` transition can only be triggered by explicit user action via the UI.
3. **Rate Limiter Required** — Every Gemini API call must go through `RateLimiter`. Never call `genai.generate_content()` directly without `_rate_limiter.wait()`.
4. **Public Data Only** — Signal sources must be publicly available data. No scraping behind authentication walls.

## Code Style

- **Formatter**: `ruff format` (Black-compatible)
- **Linter**: `ruff check --select E,W,F,I`
- **Type hints**: Required on all public functions
- **Docstrings**: Required on all modules and public functions (Google style)
- **Logging**: Use `get_logger(__name__)` — never `print()`

## Questions?

Open a [Discussion](https://github.com/CapAmin22/Prospect_AI_Agent/discussions) before starting large changes.
