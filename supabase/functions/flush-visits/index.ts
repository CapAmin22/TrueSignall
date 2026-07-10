/**
 * flush-visits — visitor session flush (docs/03 §5.2, IS-01/03).
 * Sessions idle ≥30 min → pricing-path match ⇒ pricing_visit, else
 * site_visit on 3+ page sessions. EU sessions stay company-level.
 */
import { adminClient, authorized, sha256Hex, dedupKey, fanout } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (!authorized(req)) return new Response("forbidden", { status: 403 });
  const db = adminClient();
  let signalsCreated = 0;

  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: sessions } = await db
    .from("visitor_sessions")
    .select("*")
    .eq("flushed", false)
    .lt("last_at", cutoff)
    .limit(200);

  for (const session of sessions ?? []) {
    if (!session.company_domain) {
      await db.from("visitor_sessions").update({ flushed: true }).eq("id", session.id);
      continue;
    }
    const { data: workspace } = await db
      .from("workspaces")
      .select("pricing_paths")
      .eq("id", session.workspace_id)
      .single();
    const pricingPaths: string[] = workspace?.pricing_paths ?? ["/pricing"];
    const paths: string[] = session.paths ?? [];
    const isPricing = paths.some((p) => pricingPaths.some((pp) => p.startsWith(pp)));
    const isSiteVisit = !isPricing && session.page_count >= 3;

    if (isPricing || isSiteVisit) {
      const { data: company } = await db
        .from("companies")
        .select("id")
        .eq("domain", session.company_domain)
        .single();
      if (company) {
        const type = isPricing ? "pricing_visit" : "site_visit";
        // EU rule (IS-05 / 09 §4): person data only outside EU sessions
        const person = session.is_eu ? null : session.person;
        const occurredAt = new Date(session.last_at);
        const hash = await sha256Hex(dedupKey(session.company_domain, type, session.id, occurredAt));
        const { data: inserted } = await db
          .from("signals")
          .upsert(
            {
              company_id: company.id,
              type,
              title: isPricing
                ? `Visited your pricing page (${paths.filter((p) => pricingPaths.some((pp) => p.startsWith(pp))).length}×)`
                : `${session.page_count}-page session on your site`,
              payload: isPricing
                ? { paths, visits_7d: 1, person, repeat_evaluator: false }
                : { paths, page_count: session.page_count, person },
              source: "pixel",
              source_url: null,
              occurred_at: occurredAt.toISOString(),
              dedup_hash: hash,
            },
            { onConflict: "dedup_hash", ignoreDuplicates: true },
          )
          .select("id, company_id");
        if (inserted?.length) {
          signalsCreated++;
          await fanout(db, inserted[0].id, inserted[0].company_id);
        }
      }
    }
    await db.from("visitor_sessions").update({ flushed: true }).eq("id", session.id);
  }

  return Response.json({ flushed: sessions?.length ?? 0, signals_created: signalsCreated });
});
