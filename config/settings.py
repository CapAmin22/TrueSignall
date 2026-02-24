"""
Project Signal — Typed Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Loads all environment variables with type validation via Pydantic BaseSettings.
Import `settings` anywhere in the codebase — never use os.getenv() directly.
"""

from pydantic import Field, HttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Gemini AI ──────────────────────────────────────────────────────────────
    gemini_api_key: str = Field(..., description="Google Gemini API key")
    gemini_model: str = Field("gemini-1.5-flash", description="Gemini model name")
    gemini_rpm_limit: int = Field(15, description="Gemini free-tier requests per minute")

    # ── Supabase ───────────────────────────────────────────────────────────────
    supabase_url: str = Field(..., description="Supabase project URL")
    supabase_anon_key: str = Field(..., description="Supabase anonymous key")
    supabase_service_role_key: str = Field("", description="Supabase service role key (workers)")

    # ── Qdrant Cloud ───────────────────────────────────────────────────────────
    qdrant_url: str = Field(..., description="Qdrant Cloud cluster URL")
    qdrant_api_key: str = Field(..., description="Qdrant API key")
    qdrant_collection: str = Field("nurture_drafts", description="Qdrant collection name")

    # ── Oracle VM Workers ──────────────────────────────────────────────────────
    oracle_worker_url: str = Field("", description="Oracle VM base URL for webhooks")
    oracle_worker_secret: str = Field("", description="Shared secret for worker auth")

    # ── Email Verification ─────────────────────────────────────────────────────
    sender_domain: str = Field("", description="Domain used in SMTP HELO")
    smtp_max_verifications_per_hour: int = Field(
        10, description="Max SMTP pings per target domain per hour"
    )

    # ── Signal Detection ───────────────────────────────────────────────────────
    signal_scan_interval_hours: int = Field(1, description="Signal worker scan frequency")
    duckduckgo_max_results: int = Field(20, description="Max OSINT results per DDG query")

    # ── Application ────────────────────────────────────────────────────────────
    log_level: str = Field("INFO", description="Logging level")
    environment: str = Field("development", description="development | production")

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def gemini_sleep_seconds(self) -> float:
        """
        Sleep duration to enforce Gemini RPM limit.
        At 15 RPM → must wait at least 4.1s between calls to stay under limit.
        """
        return 60.0 / self.gemini_rpm_limit + 0.1


# Singleton — import this everywhere
settings = Settings()
