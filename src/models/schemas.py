"""
src/models/schemas.py
━━━━━━━━━━━━━━━━━━━━━
Pydantic v2 data models for Project Signal.
These mirror the Supabase table structure and provide runtime validation
throughout the pipeline.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl, field_validator


class DecisionMaker(BaseModel):
    """A specific individual with purchasing power at a target company."""
    name: str
    title: str
    social_url: Optional[str] = None
    email: Optional[str] = None


class Company(BaseModel):
    """A target account in the prospect list."""
    id: Optional[UUID] = None
    domain: str
    system_status: str = "INGESTING"
    raw_html: Optional[str] = None
    extracted_market_data: Optional[dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_validator("system_status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid = {"INGESTING", "PENDING_REVIEW", "ACTIVE", "DORMANT", "BLOCKED"}
        if v not in valid:
            raise ValueError(f"Invalid system_status: {v}. Must be one of {valid}")
        return v


class Competitor(BaseModel):
    """A categorized market player in the Defensive Matrix."""
    id: Optional[UUID] = None
    target_company_id: Optional[UUID] = None
    competitor_domain: str
    competitor_name: Optional[str] = None
    threat_level: str
    weakness_context: Optional[str] = None
    positioning_notes: Optional[str] = None

    @field_validator("threat_level")
    @classmethod
    def validate_threat_level(cls, v: str) -> str:
        valid = {"DIRECT", "ADJACENT", "INDIRECT"}
        if v not in valid:
            raise ValueError(f"Invalid threat_level: {v}. Must be one of {valid}")
        return v


class Signal(BaseModel):
    """
    A detected event for a decision-maker. Becomes a Transparency Card on the dashboard.
    source_url and ai_rationale are REQUIRED — non-nullable by design (PRD Tenet #2).
    """
    id: Optional[UUID] = None
    target_company_id: UUID
    decision_maker_name: Optional[str] = None
    decision_maker_title: Optional[str] = None
    decision_maker_url: Optional[str] = None

    signal_category: str  # MACRO | MICRO
    signal_summary: str
    source_url: str = Field(..., description="Clickable link to source — non-negotiable per PRD")
    ai_rationale: str = Field(..., description="AI rationale for acting on this signal — non-negotiable per PRD")

    status: str = "UNREAD"
    ai_draft: Optional[str] = None
    human_edited_text: Optional[str] = None
    qdrant_vector_id: Optional[str] = None

    detected_at: Optional[datetime] = None
    actioned_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid = {"UNREAD", "DRAFTING", "AWAITING_APPROVAL", "APPROVED_FOR_SEND", "SENT", "IGNORED"}
        if v not in valid:
            raise ValueError(f"Invalid signal status: {v}. Must be one of {valid}")
        return v

    @field_validator("signal_category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in {"MACRO", "MICRO"}:
            raise ValueError(f"Invalid signal_category: {v}. Must be MACRO or MICRO")
        return v


class NurtureDraft(BaseModel):
    """
    A generated nurture message awaiting HITL approval.
    Cannot transition to APPROVED_FOR_SEND without explicit user action.
    """
    signal_id: UUID
    draft_text: str
    status: str = "AWAITING_APPROVAL"
    few_shot_examples_used: int = 0  # Track RAG quality over time
