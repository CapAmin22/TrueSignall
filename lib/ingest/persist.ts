import type { SupabaseClient } from "@supabase/supabase-js";
import { dedupHash } from "@/lib/signals/dedup";

/**
 * Server-side signal persistence — the PERSIST → FANOUT pipeline stages
 * (docs/05 §2) used by /api/ingest/batch and /api/clip when Supabase is
 * configured. Mirrors supabase/functions/_shared/common.ts for the Node side.
 */
export interface PersistItem {
  domain: string;
  type: string;
  title: string;
  payload: Record<string, unknown>;
  source: string;
  source_url: string | null;
  occurred_at: string;
}

/** Find-or-create a company row by canonical domain; returns its id. */
export async function resolveCompany(
  db: SupabaseClient,
  domain: string,
  name?: string,
): Promise<string | null> {
  const { data: existing } = await db
    .from("companies")
    .select("id")
    .eq("domain", domain)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created } = await db
    .from("companies")
    .upsert(
      { domain, name: name ?? domain.split(".")[0], source: "ingest" },
      { onConflict: "domain", ignoreDuplicates: false },
    )
    .select("id")
    .maybeSingle();
  return created?.id ?? null;
}

/** Fan one global signal out to every active subscribing account (docs/05 §2). */
export async function fanoutSignal(
  db: SupabaseClient,
  signalId: string,
  companyId: string,
): Promise<number> {
  const { data: accounts } = await db
    .from("accounts")
    .select("id, workspace_id, fit_score")
    .eq("company_id", companyId)
    .eq("status", "active");
  if (!accounts?.length) return 0;

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
  return rows.length;
}

/**
 * Upsert one signal (unique on dedup_hash) and fan it out.
 * Returns "created" | "duplicate" | "skipped" (company unresolvable).
 */
export async function persistSignal(
  db: SupabaseClient,
  item: PersistItem,
): Promise<"created" | "duplicate" | "skipped"> {
  const companyId = await resolveCompany(db, item.domain);
  if (!companyId) return "skipped";

  const hash = dedupHash(
    item.domain,
    item.type,
    item.source_url ?? item.title,
    new Date(item.occurred_at),
  );
  const { data: inserted } = await db
    .from("signals")
    .upsert(
      {
        company_id: companyId,
        type: item.type,
        title: item.title,
        payload: item.payload,
        source: item.source,
        source_url: item.source_url,
        occurred_at: item.occurred_at,
        dedup_hash: hash,
      },
      { onConflict: "dedup_hash", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();

  if (!inserted) return "duplicate";
  await fanoutSignal(db, inserted.id, companyId);
  return "created";
}
