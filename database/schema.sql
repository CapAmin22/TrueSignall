-- ─────────────────────────────────────────────────────────────────────────────
-- Project Signal — Supabase PostgreSQL Schema
-- Version: 1.0 (MVP)
-- Run in: Supabase Dashboard > SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: companies
-- Core entity. One row per target domain being monitored.
-- system_status acts as the pipeline state machine lock.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS companies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain          VARCHAR(255) UNIQUE NOT NULL,
    system_status   VARCHAR(50)  NOT NULL DEFAULT 'INGESTING',
    -- State machine values:
    -- INGESTING       → Scraper is running, DO NOT read extracted_market_data yet
    -- PENDING_REVIEW  → Ready for HITL. User has not approved this account yet
    -- ACTIVE          → User-approved. Signal monitoring is live
    -- DORMANT         → Manually paused or no signals in 90+ days
    -- BLOCKED         → Added to Do Not Contact list (Direct Competitor)

    raw_html        TEXT,        -- Full scraped HTML (truncated to 50k chars)
    extracted_market_data JSONB,
    -- Expected JSONB schema:
    -- {
    --   "usps": ["string", ...],
    --   "services": ["string", ...],
    --   "pricing_model": "string",
    --   "target_audience": "string",
    --   "decision_makers": [
    --     {"name": "string", "title": "string", "social_url": "string", "email": "string|null"}
    --   ]
    -- }

    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on modification
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: competitors
-- Tri-tier competitive landscape per target company's ICP space.
-- DIRECT competitors are auto-blocklisted.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS competitors (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    competitor_domain   VARCHAR(255) NOT NULL,
    competitor_name     VARCHAR(255),
    threat_level        VARCHAR(50)  NOT NULL,
    -- DIRECT   → Exact product match. Auto-added to blocklist. Never contact.
    -- ADJACENT → Same audience, different problem. Flag as potential partner.
    -- INDIRECT → Same problem, different method. Monitor for intelligence.

    weakness_context    TEXT,        -- Scraped G2/Capterra weakness themes (AI-extracted)
    positioning_notes   TEXT,        -- How user's USPs counter this competitor
    reviewed_at         TIMESTAMPTZ, -- When user locked this entry in the matrix

    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_competitor_mapping UNIQUE (target_company_id, competitor_domain)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: signals
-- The heart of Project Signal. Every monitored event for every decision-maker.
-- Each row becomes a "Transparency Card" on the Nurturing Dashboard.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS signals (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    decision_maker_name VARCHAR(255),
    decision_maker_title VARCHAR(255),
    decision_maker_url  TEXT,        -- LinkedIn profile URL of the signal subject

    signal_category     VARCHAR(50)  NOT NULL,
    -- MACRO → Company-level: Funding, M&A, Hiring Surge, Geographic Expansion, New Product
    -- MICRO → Personal:      Job Change, Promotion, Award, Speaking Engagement,
    --                        Work Anniversary, Life Event (publicly posted)

    signal_summary      TEXT         NOT NULL,  -- Human-readable description of the event
    source_url          TEXT         NOT NULL,  -- REQUIRED: clickable link to original post/article
    ai_rationale        TEXT         NOT NULL,  -- REQUIRED: Gemini's plain-text "why act on this now"

    status              VARCHAR(50)  NOT NULL DEFAULT 'UNREAD',
    -- UNREAD           → Signal card surfaced, user has not acted
    -- DRAFTING         → User clicked "Draft Action" — worker is generating copy
    -- AWAITING_APPROVAL → AI draft written, waiting for user HITL approval
    -- APPROVED_FOR_SEND → User approved the draft
    -- SENT             → Message dispatched (v1.1 integration)
    -- IGNORED          → User dismissed this signal

    ai_draft            TEXT,        -- Generated nurture copy (populated during DRAFTING state)
    human_edited_text   TEXT,        -- What the user actually sent (for RLHF diff)
    qdrant_vector_id    VARCHAR(255), -- Pointer to embedding in Qdrant (set after RLHF sync)

    detected_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    actioned_at         TIMESTAMPTZ,
    sent_at             TIMESTAMPTZ
);

-- Index for dashboard queries (per company, recent unread signals)
CREATE INDEX IF NOT EXISTS idx_signals_company_status
    ON signals (target_company_id, status, detected_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- REALTIME: Enable Supabase WebSocket broadcast for HITL events
-- The Oracle VM writes a signal row → Supabase fires a WebSocket event
-- → Vercel frontend renders the Transparency Card instantly.
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE signals;
ALTER PUBLICATION supabase_realtime ADD TABLE companies;

-- ═══════════════════════════════════════════════════════════════════════════════
-- GDPR/CCPA: Hard-delete support
-- Cascade deletes ensure full erasure across all related tables.
-- This function scrubs a prospect completely from the active database.
-- The Qdrant vector purge must be triggered separately via qdrant_sync.py.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION hard_delete_prospect(p_domain VARCHAR)
RETURNS void AS $$
DECLARE
    v_company_id UUID;
BEGIN
    SELECT id INTO v_company_id FROM companies WHERE domain = p_domain;
    IF v_company_id IS NULL THEN
        RAISE NOTICE 'Prospect % not found — no action taken.', p_domain;
        RETURN;
    END IF;
    -- CASCADE will handle signals and competitors via FK constraints
    DELETE FROM companies WHERE id = v_company_id;
    RAISE NOTICE 'Hard-deleted prospect % (id: %) and all related data.', p_domain, v_company_id;
END;
$$ LANGUAGE plpgsql;
