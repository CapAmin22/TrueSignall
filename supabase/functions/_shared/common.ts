/**
 * Shared helpers for Edge Functions — docs/07 §5.
 * All functions: CRON_SECRET auth, idempotent, ≤30s budget, write
 * ingestion_runs, exit 0 even on partial failure.
 */
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export function authorized(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  const secret = Deno.env.get("CRON_SECRET") ?? "";
  return secret.length > 0 && header === `Bearer ${secret}`;
}

export async function startRun(
  db: SupabaseClient,
  sourceKey: string,
  shard = 0,
): Promise<number | null> {
  const { data } = await db
    .from("ingestion_runs")
    .insert({ source_key: sourceKey, shard, status: "running", started_at: new Date().toISOString() })
    .select("id")
    .single();
  return data?.id ?? null;
}

export async function finishRun(
  db: SupabaseClient,
  runId: number | null,
  ok: boolean,
  counts: { items_found?: number; signals_created?: number },
  error?: string,
) {
  if (runId === null) return;
  await db
    .from("ingestion_runs")
    .update({
      status: ok ? "ok" : "error",
      finished_at: new Date().toISOString(),
      ...counts,
      error: error ?? null,
    })
    .eq("id", runId);
}

/** Source health bookkeeping — auto-disable at 5 consecutive failures (03 §6). */
export async function recordSourceResult(db: SupabaseClient, key: string, ok: boolean) {
  if (ok) {
    await db
      .from("sources")
      .update({ last_run_at: new Date().toISOString(), last_success_at: new Date().toISOString(), consecutive_failures: 0 })
      .eq("key", key);
    return;
  }
  const { data } = await db.from("sources").select("consecutive_failures").eq("key", key).single();
  const failures = (data?.consecutive_failures ?? 0) + 1;
  await db
    .from("sources")
    .update({
      last_run_at: new Date().toISOString(),
      consecutive_failures: failures,
      enabled: failures < 5,
    })
    .eq("key", key);
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function dedupKey(domain: string, type: string, urlOrTitle: string, occurredAt: Date): string {
  const canonical = urlOrTitle.startsWith("http")
    ? urlOrTitle.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
    : urlOrTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${domain}|${type}|${canonical}|${occurredAt.toISOString().slice(0, 10)}`;
}

/** Fan-out one signal to all subscribing workspace-accounts — docs/05 §2. */
export async function fanout(db: SupabaseClient, signalId: string, companyId: string) {
  const { data: accounts } = await db
    .from("accounts")
    .select("id, workspace_id, fit_score")
    .eq("company_id", companyId)
    .eq("status", "active");
  if (!accounts?.length) return;

  const rows = accounts.map((a) => ({
    workspace_id: a.workspace_id,
    account_id: a.id,
    signal_id: signalId,
    urgency: Math.round(50 * (0.6 + 0.8 * ((a.fit_score ?? 50) / 100))),
  }));
  await db.from("signal_deliveries").upsert(rows, {
    onConflict: "workspace_id,signal_id,account_id",
    ignoreDuplicates: true,
  });
  // Full urgency (decay + stacking) is refreshed by the score-decay cron.
}
