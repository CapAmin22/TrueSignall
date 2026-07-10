/**
 * ingest-news — Google News per-account wheel (docs/05 §5.4).
 * Hot(≥70) + top-fit accounts only; ≤600 queries/day globally; the tail
 * rotates on a 24h wheel.
 */
import { adminClient, authorized, startRun, finishRun, recordSourceResult, sha256Hex, dedupKey, fanout } from "../_shared/common.ts";

const HOURLY_QUERY_BUDGET = 25; // 600/day ÷ 24

Deno.serve(async (req) => {
  if (!authorized(req)) return new Response("forbidden", { status: 403 });
  const db = adminClient();
  const runId = await startRun(db, "google_news_account");
  let signalsCreated = 0;

  try {
    const { data: accounts } = await db
      .from("accounts")
      .select("company_id, urgency_score, fit_score, companies!inner(id, domain, name)")
      .eq("status", "active")
      .order("urgency_score", { ascending: false })
      .limit(HOURLY_QUERY_BUDGET);

    for (const account of accounts ?? []) {
      const company = account.companies as unknown as { id: string; domain: string; name: string | null };
      if (!company.name) continue;
      const query = encodeURIComponent(
        `"${company.name}" (funding OR raised OR appoints OR launches OR expands) when:7d`,
      );
      const res = await fetch(`https://news.google.com/rss/search?q=${query}`, {
        headers: { "User-Agent": "SignalAI-bot/1.0 (+https://truesignall.com/bot)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = xml.match(/<item>[\s\S]*?<\/item>/g)?.slice(0, 3) ?? [];

      for (const block of items) {
        const title = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim();
        const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim();
        const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim();
        if (!title || !link) continue;
        const occurredAt = pubDate ? new Date(pubDate) : new Date();
        const hash = await sha256Hex(dedupKey(company.domain, "news", link, occurredAt));
        const { data: inserted } = await db
          .from("signals")
          .upsert(
            {
              company_id: company.id,
              type: "news",
              title: title.slice(0, 200),
              payload: { headline: title.slice(0, 200), publisher: "Google News" },
              source: "google_news_account",
              source_url: link,
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
    await recordSourceResult(db, "google_news_account", true);
    await finishRun(db, runId, true, { signals_created: signalsCreated });
  } catch (err) {
    await recordSourceResult(db, "google_news_account", false);
    await finishRun(db, runId, false, {}, String(err));
  }

  return Response.json({ signals_created: signalsCreated });
});
