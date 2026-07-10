/**
 * POST /api/ingest/batch — GH Actions crawler ingest endpoint (docs/07 §3).
 * CRON_SECRET bearer → body {source_key, items[]} → pipeline stages
 * EXTRACT → RESOLVE → NORMALIZE → DEDUP → PERSIST → FANOUT (docs/05 §2).
 */
import { z } from "zod";
import { verifyCronSecret } from "@/lib/rate-limit";
import { errorResponse, AppError } from "@/lib/errors";
import { dedupHash } from "@/lib/signals/dedup";
import { classifyJobTitle } from "@/lib/signals/hiring-map";
import { classifyHeadline } from "@/lib/signals/classifiers";
import { normalizeDomain } from "@/lib/utils";
import { SIGNAL_TYPES } from "@/lib/signals/taxonomy";

const itemSchema = z.object({
  domain: z.string(),
  type: z.enum(SIGNAL_TYPES),
  title: z.string(),
  payload: z.record(z.string(), z.unknown()).default({}),
  source_url: z.string().nullable().default(null),
  occurred_at: z.string(),
});

const bodySchema = z.object({
  source_key: z.string(),
  items: z.array(itemSchema).max(500),
});

export async function POST(request: Request) {
  if (!verifyCronSecret(request.headers.get("authorization"))) {
    return errorResponse(new AppError("FORBIDDEN", "Invalid or missing CRON_SECRET."));
  }

  try {
    const body = bodySchema.parse(await request.json());
    const seen = new Set<string>();
    let created = 0;
    let deduped = 0;

    for (const item of body.items) {
      const domain = normalizeDomain(item.domain);
      const hash = dedupHash(
        domain,
        item.type,
        item.source_url ?? item.title,
        new Date(item.occurred_at),
      );
      if (seen.has(hash)) {
        deduped++;
        continue;
      }
      seen.add(hash);

      // Enrich payloads with deterministic classification where applicable.
      if (item.type === "hiring" && typeof item.payload.job_title === "string") {
        const cls = classifyJobTitle(item.payload.job_title, item.payload.dept as string);
        item.payload.inferred_category = cls.category;
        item.payload.confidence = cls.confidence;
      }
      if (item.type === "news") {
        const cls = classifyHeadline(item.title);
        if (cls.isSignal && cls.type) item.payload.reclassified_as = cls.type;
      }

      // Configured deployment: unique-upsert into signals + fanout to
      // signal_deliveries via the service role. Prototype counts only.
      created++;
    }

    return Response.json({ created, deduped });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(new AppError("VALIDATION", "Invalid batch payload.", { issues: err.issues }));
    }
    return errorResponse(err);
  }
}
