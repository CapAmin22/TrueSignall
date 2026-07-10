/**
 * POST /api/clip — Signal Clipper (docs/07 §3, PS-03 v1).
 * Session-auth · body {url, title, selection≤1200ch, domain?} · LLM relevance
 * vs ICP pain points → linkedin_clip signal + delivery. User-initiated capture
 * only — we never issue requests to LinkedIn (docs/09 §5).
 */
import { z } from "zod";
import { callLLMJson } from "@/lib/ai/router";
import { errorResponse, AppError } from "@/lib/errors";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isAdminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { persistSignal } from "@/lib/ingest/persist";
import { normalizeDomain } from "@/lib/utils";

const bodySchema = z.object({
  url: z.string().url(),
  title: z.string().max(300),
  selection: z.string().min(10).max(1200),
  domain: z.string().max(120).optional(), // target company, when the user supplies it
});

const relevanceSchema = z.object({
  relevance: z.enum(["high", "med", "low"]),
  matched_pains: z.array(z.string()),
});

const PUBLIC_POST_PATTERN = /^https:\/\/(www\.)?linkedin\.com\/(posts|feed\/update)\//i;

async function requireSession(): Promise<boolean> {
  if (!isSupabaseConfigured()) return true; // demo mode: open
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user);
}

export async function POST(request: Request) {
  try {
    if (!(await requireSession())) {
      return errorResponse(new AppError("FORBIDDEN", "Sign in to clip signals."));
    }
    const body = bodySchema.parse(await request.json().catch(() => ({})));

    if (!PUBLIC_POST_PATTERN.test(body.url)) {
      throw new AppError("VALIDATION", "URL must be a public LinkedIn post.");
    }

    const relevance = await callLLMJson({
      task: "clip_relevance",
      prompt: `TASK: Rate how relevant this public post excerpt is to the workspace ICP pain points.\nEXCERPT: "${body.selection}"\nReturn JSON: {"relevance":"high"|"med"|"low","matched_pains":[matching pain point strings]}`,
      chain: "cheap",
      schema: relevanceSchema,
    });

    let deliveryId = `d-clip-${Date.now()}`;
    if (isAdminConfigured() && body.domain) {
      const outcome = await persistSignal(createAdminClient(), {
        domain: normalizeDomain(body.domain),
        type: "linkedin_clip",
        title: body.title || "LinkedIn post clipped",
        payload: { excerpt: body.selection.slice(0, 500), relevance: relevance.relevance },
        source: "clipper",
        source_url: body.url,
        occurred_at: new Date().toISOString(),
      });
      deliveryId = `clip-${outcome}`;
    }

    return Response.json({
      deliveryId,
      relevance: relevance.relevance,
      matched_pains: relevance.matched_pains,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(new AppError("VALIDATION", "Invalid clip payload.", { issues: err.issues }));
    }
    return errorResponse(err);
  }
}
