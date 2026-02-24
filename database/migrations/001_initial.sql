-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 001: Initial Schema
-- Idempotent — safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

-- Run the full schema (idempotent via IF NOT EXISTS guards)
\i ../schema.sql

COMMIT;
