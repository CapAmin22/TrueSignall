/**
 * GET /api/cron/health — per-source freshness for the GH Actions monitor
 * step (docs/07 §3, 05 §10).
 */
import { verifyCronSecret } from "@/lib/rate-limit";
import { errorResponse, AppError } from "@/lib/errors";
import { sources } from "@/lib/demo/data";

export async function GET(request: Request) {
  if (!verifyCronSecret(request.headers.get("authorization"))) {
    return errorResponse(new AppError("FORBIDDEN", "Invalid or missing CRON_SECRET."));
  }

  // Configured deployment reads the sources table; the shape is identical.
  return Response.json({
    checked_at: new Date().toISOString(),
    sources: sources.map((s) => ({
      key: s.key,
      kind: s.kind,
      enabled: s.enabled,
      cadence_minutes: s.cadence_minutes,
      last_success_minutes_ago: s.last_success_minutes_ago,
      consecutive_failures: s.consecutive_failures,
      stale:
        s.cadence_minutes > 0 && s.last_success_minutes_ago > s.cadence_minutes * 4,
    })),
  });
}
