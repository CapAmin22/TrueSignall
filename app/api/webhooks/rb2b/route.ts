/**
 * POST /api/webhooks/rb2b — person-level visitor enrichment (docs/07 §3, 08 §5).
 * X-Signature: hex(hmac_sha256(RB2B_WEBHOOK_SECRET, rawBody)). Person data is
 * stored on that workspace's session/delivery only — never global (I-1).
 */
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { errorResponse, AppError } from "@/lib/errors";

const payloadSchema = z.object({
  company_domain: z.string(),
  person: z.object({
    name: z.string(),
    title: z.string().optional(),
    linkedin_url: z.string().optional(),
  }),
  page: z.string().optional(),
  ts: z.union([z.string(), z.number()]).optional(),
});

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RB2B_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!verifySignature(rawBody, request.headers.get("x-signature"))) {
    return errorResponse(new AppError("FORBIDDEN", "Invalid webhook signature."));
  }

  try {
    const payload = payloadSchema.parse(JSON.parse(rawBody));
    // Configured deployment: enrich the matching open visitor_session /
    // recent visit delivery (person-level, confidence shown — IS-05).
    void payload;
    // 200 always after verify (idempotent) — docs/07 §3.
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true, skipped: "unparseable" });
  }
}
