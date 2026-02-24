---
name: 🐛 Bug Report
about: Report a broken signal, pipeline error, or unexpected behavior
title: "[BUG] "
labels: ["bug", "needs-triage"]
assignees: []
---

## 🐛 Bug Description
A clear, concise description of what the bug is.

## 🔍 Pipeline Stage
Which stage did this occur in?
- [ ] Module 1 — URL Ingestion / USP Extraction
- [ ] Module 1 — ICP Generation / Decision-Maker Mapping
- [ ] Module 2 — Competitor Matrix / Battlecard Generation
- [ ] Module 3 — Signal Detection (OSINT)
- [ ] Module 3 — Transparency Card / AI Rationale Generation
- [ ] Module 4 — Drafting (Prompt Builder / Copy Drafter)
- [ ] RLHF — Embedding / Qdrant Sync
- [ ] Worker — signal_worker.py
- [ ] Worker — rlhf_sync_worker.py
- [ ] Worker — healthcheck_worker.py
- [ ] Database — Supabase state machine
- [ ] Other

## 📋 Signal ID (if applicable)
`signal_id`: <!-- UUID from the Supabase signals table, if relevant -->

## 🔁 Steps to Reproduce
1. ...
2. ...
3. ...

## ✅ Expected Behavior
What should have happened?

## ❌ Actual Behavior
What actually happened?

## 🪵 Logs / Error Output
```
Paste relevant log output here
```

## 🌍 Environment
- Python version: 
- Deployment: Oracle VM / Local
- `ENVIRONMENT` value: development / production

## 📎 Additional Context
Any additional information (signal source URL, screenshot, etc.)
