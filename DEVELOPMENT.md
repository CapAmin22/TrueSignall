# DEVELOPMENT.md — Engineer Onboarding Guide
# Project Signal — CONFIDENTIAL

> ⚠ **CLASSIFIED.** By reading this document you confirm you are an authorized team member under a valid NDA.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Environment Setup](#2-local-environment-setup)
3. [Environment Variables Reference](#3-environment-variables-reference)
4. [Running the Pipeline Locally](#4-running-the-pipeline-locally)
5. [Oracle VM Setup (Production Workers)](#5-oracle-vm-setup-production-workers)
6. [Supabase Database Setup](#6-supabase-database-setup)
7. [Qdrant Cloud Setup](#7-qdrant-cloud-setup)
8. [CI/CD Pipeline](#8-cicd-pipeline)
9. [Debugging Guide](#9-debugging-guide)
10. [Rate Limits & Gotchas](#10-rate-limits--gotchas)

---

## 1. Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Python | **3.11+** | Runtime (3.10 will not work — we use `X | Y` union syntax) |
| Git | Any | Version control |
| A Supabase account | — | Free tier (→ [supabase.com](https://supabase.com)) |
| A Qdrant Cloud account | — | Free tier (→ [qdrant.tech](https://qdrant.tech/cloud)) |
| A Google AI Studio account | — | Gemini 1.5 Flash API key (→ [aistudio.google.com](https://aistudio.google.com)) |
| A browser (Chromium) | — | Installed automatically via `playwright install` |

---

## 2. Local Environment Setup

```bash
# 1. Clone the private repository
git clone https://github.com/CapAmin22/Signal.AI.git
cd Signal.AI

# 2. Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows PowerShell
# source venv/bin/activate    # macOS/Linux

# 3. Install all Python dependencies
pip install -r requirements.txt

# 4. Install Playwright's Chromium browser
playwright install chromium

# 5. Set up environment variables
cp .env.example .env
# Open .env in your editor and fill in all values
# (see Section 3 below for full reference)

# 6. Verify setup
python -c "from config.settings import settings; print('✅ Settings loaded:', settings.environment)"
```

---

## 3. Environment Variables Reference

All secrets live in `.env` (never committed — protected by `.gitignore`).

| Variable | Required | Source | Notes |
|---|---|---|---|
| `GEMINI_API_KEY` | ✅ Yes | [aistudio.google.com](https://aistudio.google.com) | Free tier: 15 RPM |
| `SUPABASE_URL` | ✅ Yes | Supabase Dashboard → Settings → API | `https://<project>.supabase.co` |
| `SUPABASE_ANON_KEY` | ✅ Yes | Supabase Dashboard → Settings → API | For Vercel frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | Supabase Dashboard → Settings → API | **NEVER expose in frontend** |
| `QDRANT_URL` | ✅ Yes | Qdrant Cloud → Cluster → Endpoint | `https://<cluster>.qdrant.io` |
| `QDRANT_API_KEY` | ✅ Yes | Qdrant Cloud → Cluster → API Keys | |
| `QDRANT_COLLECTION` | ✅ Yes | Your choice | Default: `nurture_drafts` |
| `ORACLE_WORKER_SECRET` | ✅ Yes | You generate | Used to authenticate worker webhooks |
| `SENDER_NAME` | ✅ Yes | Your full name | Appears in nurture message signature |
| `SENDER_ROLE` | ✅ Yes | Your title | Appears in nurture message signature |
| `ENVIRONMENT` | No | `development` or `production` | Controls log level |
| `LOG_LEVEL` | No | `INFO` | `DEBUG` for verbose, `WARNING` for quiet |

---

## 4. Running the Pipeline Locally

### Full Pipeline (all 4 modules)

```bash
python main.py --url https://target-company.com
```

### Per-module runs (useful for debugging)

```bash
# Module 1-A: Scrape and extract USPs
python -c "
import asyncio
from src.ingestion.scraper import scrape_brand_info
from src.ingestion.usp_extractor import extract_usps
async def run():
    content = await scrape_brand_info('https://hubspot.com')
    result = await extract_usps(content, 'hubspot.com')
    print(result)
asyncio.run(run())
"

# Module 1-B: ICP generation (reads from Supabase)
python -c "
import asyncio
from src.intelligence.icp_generator import generate_target_account_list
asyncio.run(generate_target_account_list({'usps': ['CRM for SMBs'], 'audience': 'B2B SaaS'}))
"

# Module 3: Manual signal detection test
python workers/signal_worker.py
```

### Workers (standalone test runs)

```bash
python workers/signal_worker.py        # Test hourly signal detection
python workers/rlhf_sync_worker.py     # Test Qdrant sync (needs SENT signals in Supabase)
python workers/healthcheck_worker.py   # Test Supabase connection
```

---

## 5. Oracle VM Setup (Production Workers)

> These workers run on an Oracle Cloud Always Free ARM VM (4 OCPU, 24 GB RAM, Ubuntu 22.04).

### Initial VM provisioning

```bash
# On your local machine — SSH into the VM
ssh -i ~/.oci/project_signal.pem ubuntu@<YOUR_VM_ELASTIC_IP>

# Update and install dependencies
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.11 python3.11-venv python3-pip git

# Clone the repo
git clone https://github.com/CapAmin22/Signal.AI.git ~/Signal.AI
cd ~/Signal.AI

# Set up Python environment
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium --with-deps

# Set up .env
cp .env.example .env
nano .env  # Fill in all production values
```

### Cron schedule setup

```bash
crontab -e
```

Add these lines:

```cron
# Project Signal — Production Worker Schedule

# Signal detection: every hour at :05
5 * * * * /home/ubuntu/Signal.AI/venv/bin/python /home/ubuntu/Signal.AI/workers/signal_worker.py >> /var/log/signal_worker.log 2>&1

# RLHF sync: every Sunday at 2 AM
0 2 * * 0 /home/ubuntu/Signal.AI/venv/bin/python /home/ubuntu/Signal.AI/workers/rlhf_sync_worker.py >> /var/log/rlhf_sync.log 2>&1

# Supabase keep-alive: Monday and Thursday at midnight
0 0 * * 1,4 /home/ubuntu/Signal.AI/venv/bin/python /home/ubuntu/Signal.AI/workers/healthcheck_worker.py >> /var/log/healthcheck.log 2>&1
```

### Keeping the repo up to date on the VM

```bash
cd ~/Signal.AI && git pull origin main && source venv/bin/activate && pip install -r requirements.txt
```

---

## 6. Supabase Database Setup

### First-time schema deployment

1. Go to **Supabase Dashboard → SQL Editor**
2. Open `database/schema.sql` from this repo
3. Copy and paste the entire file content
4. Click **Run**

You should see tables: `companies`, `signals`, `competitors` plus the `hard_delete_prospect()` function.

### Key database operations

```sql
-- Check signal state breakdown
SELECT status, COUNT(*) FROM signals GROUP BY status;

-- Manually trigger a GDPR erasure
SELECT hard_delete_prospect('target-company.com');

-- Unblock a company (e.g., if a competitor relationship changes)
UPDATE companies SET system_status = 'DORMANT' WHERE domain = 'ex-competitor.com';
```

### Supabase Realtime (WebSocket)

The Vercel frontend subscribes to Supabase Realtime on the `signals` table. To enable:

1. Supabase Dashboard → **Database → Replication**
2. Enable realtime for the `signals` table (INSERT events)

---

## 7. Qdrant Cloud Setup

1. Create a free cluster at [qdrant.tech/cloud](https://cloud.qdrant.tech/)
2. Region: choose nearest to your Oracle VM
3. Copy **Endpoint URL** and **API Key** → `.env`
4. The collection (`nurture_drafts`) is **created automatically** by `qdrant_sync.py` on first run

> **Note:** The embedder (`all-MiniLM-L6-v2`) downloads ~80MB on first run and caches it in `~/.cache/torch`. Leave 200MB free on the Oracle VM.

---

## 8. CI/CD Pipeline

GitHub Actions runs on every push to `main` and `develop`.

**Pipeline steps:**
1. `ruff check` — linting (E, W, F, I rules)
2. `mypy` — type checking (non-blocking warnings)
3. Offline schema validation — instantiates Pydantic models without API keys

**To run CI checks locally before pushing:**

```bash
pip install ruff mypy
ruff check src/ workers/ config/ --select E,W,F,I
mypy src/ workers/ config/ --ignore-missing-imports --python-version 3.11
```

---

## 9. Debugging Guide

### Gemini HTTP 429 errors

**Cause:** Exceeded 15 RPM free-tier limit.
**Fix:** Every Gemini call must go through `_rate_limiter.wait()` in `src/utils/rate_limiter.py`. Check that no module is bypassing it.

```python
# Correct pattern
from src.utils.rate_limiter import RateLimiter
_limiter = RateLimiter(rpm=15)

async def my_gemini_call():
    _limiter.wait()  # ← ALWAYS call first
    response = model.generate_content(prompt)
```

### Playwright timeout / no content scraped

**Cause:** Site has heavy JS or bot detection.
**Fix:** Increase `timeout` in `scraper.py`, or add `page.wait_for_selector()` for a known element.

### Supabase `relation does not exist` error

**Cause:** Schema not deployed yet.
**Fix:** Run `database/schema.sql` in the Supabase SQL Editor.

### Oracle VM SMTP connection refused

**Cause:** OCI blocks port 25 by default on some shapes.
**Fix:** Submit a request in OCI Console → Support → "Remove Email Sending Limit".

---

## 10. Rate Limits & Gotchas

| Service | Limit | Our Mitigation |
|---|---|---|
| Gemini 1.5 Flash | 15 RPM | `RateLimiter(rpm=15)` → 4.1s sleep |
| DuckDuckGo Search | Soft limit | 0.8–1.5s random delay between searches |
| SMTP verification | IP reputation | Max 10 pings/domain/hour per `email_verifier.py` |
| Supabase free tier | 500MB storage | Archive old `SENT` signals periodically |
| Qdrant free tier | 1 GB / cluster | All-MiniLM-L6-v2 = 384 dims × 4 bytes ≈ 65,000 vectors |

---

*Last updated: February 2026 — Project Signal Engineering Team*

> ⚠ **CONFIDENTIAL** — Do not share outside the authorized team.
