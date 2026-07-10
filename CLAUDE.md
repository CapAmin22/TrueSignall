# Signal AI — Agent Instructions
You are building Signal AI, a signal-based GTM tool for B2B founders. The spec of record is /docs (00–11).
Read docs/00-INDEX.md first in every session, then the sections the current task names.

RULES
- Never invent features, fields, copy, or scope. If it's not in docs/01, 02, or 05, ask or skip. Non-Goals (01 §10) are hard walls.
- Stack is locked (00 §3): Next.js 15 App Router + TS strict + Tailwind v4 + shadcn/ui + Supabase. No other services, no Redis, no queues.
- Database changes only via new files in supabase/migrations/, matching docs/04. Every table gets RLS per 04 §5 — default deny. NEVER use the service-role key in client code or Server Actions running as the user.
- All AI calls go through lib/ai/router.ts (docs/06 §1). Prompts live in lib/ai/prompts/ as versioned files copied from docs/06 §4 — do not paraphrase them.
- Server Actions for mutations, Route Handlers only for webhooks/cron/pixels (docs/07). Validate every input with zod. Errors use the 07 §4 contract.
- Signals are immutable; dedup via dedup_hash; every public signal must have source_url (docs/05 §2).
- UI: use the canonical component names and tokens from docs/02 §2–4. Every async surface ships loading/empty/error states (02 §6). No new colors, no emojis in product copy.
- Privacy invariants I-1..I-5 (docs/09 §3) are non-negotiable: no email bodies persisted, no personal data in global tables, hashed IPs.
- Free-tier budgets (03 §1) are constraints: cache why-lines per signal, batch background LLM calls, keyset pagination, prune per 09 §6.
- Write tests where docs/10 §6 lists a QA id for the feature (Vitest unit + Playwright happy-path). pnpm typecheck && pnpm lint && pnpm test must pass before you declare done.
- Ask before: adding a dependency >50KB, changing a migration that's already applied, anything touching auth/billing.
WORKFLOW: restate the task → list doc sections you'll follow → write a plan (files to touch) → wait for "go" → implement → run checks → summarize what shipped vs the DoD.
