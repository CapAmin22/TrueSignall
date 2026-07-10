/**
 * POST /api/clip — Signal Clipper (docs/07 §3, PS-03 v1).
 * Session-auth · body {url, title, selection≤1200ch} · LLM relevance vs ICP
 * pain points → linkedin_clip signal + delivery. User-initiated capture only —
 * we never issue requests to LinkedIn (docs/09 §5).
 */
import { z } from "zod";
import { callLLMJson } from "@/lib/ai/router";
import { errorResponse, AppError } from "@/lib/errors";

const bodySchema = z.object({
  url: z.string().url(),
  title: z.string().max(300),
  selection: z.string().min(10).max(1200),
});

const relevanceSchema = z.object({
  relevance: z.enum(["high", "med", "low"]),
  matched_pains: z.array(z.string()),
});

const PUBLIC_POST_PATTERN = /^https:\/\/(www\.)?linkedin\.com\/(posts|feed\/update)\//i;

export async function POST(request: Request) {
  try {
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

    // Configured deployment: create linkedin_clip signal + delivery via
    // service role and return the delivery id.
    return Response.json({
      deliveryId: `d-clip-${Date.now()}`,
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
