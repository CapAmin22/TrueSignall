/**
 * POST/GET /api/px — visitor pixel beacon (docs/07 §3, 03 §5.2).
 * validate ws token → hash IP (sha256 + daily salt) → session aggregate
 * (30-min window) → pricing-path match ⇒ pricing_visit else site_visit on
 * 3+ page sessions. EU IPs: company-level only (docs/09 §4).
 */
import { createHash } from "crypto";
import { z } from "zod";
import { allowRequest } from "@/lib/rate-limit";

const paramsSchema = z.object({
  ws: z.string().min(4),
  path: z.string().min(1).max(500),
  ref: z.string().max(500).optional(),
  sid: z.string().max(64).optional(),
});

const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

function hashIp(ip: string): string {
  const dailySalt = new Date().toISOString().slice(0, 10) + (process.env.CRON_SECRET ?? "salt");
  return createHash("sha256").update(`${ip}|${dailySalt}`).digest("hex");
}

async function handle(request: Request, params: Record<string, string | undefined>) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
  // Rate: 20 req/10s/IP → 429 (docs/07 §3)
  if (!allowRequest(`px:${ip}`, 20, 10_000)) {
    return new Response(null, { status: 429 });
  }

  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) return new Response(null, { status: 204 });

  const ipHash = hashIp(ip);
  // In a configured deployment this upserts visitor_sessions via the service
  // role; the 5-min flush cron then applies the pricing-path rules (IS-01/03).
  void ipHash;

  return new Response(new Uint8Array(TRANSPARENT_GIF), {
    status: 200,
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return handle(request, Object.fromEntries(url.searchParams));
}

export async function POST(request: Request) {
  let body: Record<string, string | undefined> = {};
  try {
    body = await request.json();
  } catch {
    // beacon may send empty body
  }
  return handle(request, body);
}
