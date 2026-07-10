/**
 * POST/GET /api/px — visitor pixel beacon (docs/07 §3, 03 §5.2).
 * validate ws token → hash IP (sha256 + daily salt) → session aggregate
 * (30-min window) → pricing-path match ⇒ pricing_visit else site_visit on
 * 3+ page sessions. EU IPs: company-level only (docs/09 §4).
 */
import { createHash } from "crypto";
import { z } from "zod";
import { allowRequest } from "@/lib/rate-limit";
import { isAdminConfigured, createAdminClient } from "@/lib/supabase/admin";

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EU_COUNTRIES = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT",
  "LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO","GB",
]);

/** Upsert into the 30-min visitor_sessions aggregation window (docs/03 §5.2). */
async function recordVisit(ws: string, path: string, ipHash: string, isEu: boolean) {
  if (!isAdminConfigured() || !UUID_RE.test(ws)) return;
  const db = createAdminClient();
  const windowStart = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: open } = await db
    .from("visitor_sessions")
    .select("id, paths, page_count")
    .eq("workspace_id", ws)
    .eq("ip_hash", ipHash)
    .eq("flushed", false)
    .gte("last_at", windowStart)
    .limit(1)
    .maybeSingle();

  if (open) {
    await db
      .from("visitor_sessions")
      .update({
        paths: [...new Set([...(open.paths ?? []), path])].slice(0, 50),
        page_count: (open.page_count ?? 0) + 1,
        last_at: new Date().toISOString(),
      })
      .eq("id", open.id);
    return;
  }
  await db.from("visitor_sessions").insert({
    workspace_id: ws,
    ip_hash: ipHash,
    is_eu: isEu,
    paths: [path],
    page_count: 1,
  });
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
  const country = request.headers.get("x-vercel-ip-country") ?? "";
  // The 5-min flush cron applies the pricing-path rules (IS-01/03) after this.
  await recordVisit(parsed.data.ws, parsed.data.path, ipHash, EU_COUNTRIES.has(country)).catch(
    () => undefined,
  );

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
