/**
 * GET /api/cron/health — per-source freshness for the GH Actions monitor
 * step (docs/07 §3, 05 §10). Reads the sources table when Supabase is
 * configured; demo fixtures otherwise (identical shape).
 */
import { verifyCronSecret } from "@/lib/rate-limit";
import { errorResponse, AppError } from "@/lib/errors";
import { isAdminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { sources as demoSources } from "@/lib/demo/data";

interface SourceRow {
  key: string;
  kind: string;
  enabled: boolean;
  cadence_minutes: number;
  last_success_at: string | null;
  consecutive_failures: number;
}

function minutesAgo(iso: string | null): number {
  if (!iso) return Number.MAX_SAFE_INTEGER;
  return Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
}

async function liveSources() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("sources")
    .select("key, kind, enabled, cadence_minutes, last_success_at, consecutive_failures");
  if (error) throw new AppError("INTERNAL", "sources table unreadable.");
  return (data as SourceRow[]).map((s) => ({
    key: s.key,
    kind: s.kind,
    enabled: s.enabled,
    cadence_minutes: s.cadence_minutes,
    last_success_minutes_ago: minutesAgo(s.last_success_at),
    consecutive_failures: s.consecutive_failures,
  }));
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request.headers.get("authorization"))) {
    return errorResponse(new AppError("FORBIDDEN", "Invalid or missing CRON_SECRET."));
  }

  try {
    const rows = isAdminConfigured()
      ? await liveSources()
      : demoSources.map((s) => ({
          key: s.key,
          kind: s.kind,
          enabled: s.enabled,
          cadence_minutes: s.cadence_minutes,
          last_success_minutes_ago: s.last_success_minutes_ago,
          consecutive_failures: s.consecutive_failures,
        }));

    return Response.json({
      checked_at: new Date().toISOString(),
      live: isAdminConfigured(),
      sources: rows.map((s) => ({
        ...s,
        stale:
          s.cadence_minutes > 0 && s.last_success_minutes_ago > s.cadence_minutes * 4,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
