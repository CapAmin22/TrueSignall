/**
 * ingest-rss — RSS pool poller (docs/05 §5.1, 03 §5.1).
 * Conditional GET (ETag) → regex classifiers → resolve company by domain →
 * dedup upsert → fanout. Shards sized ≤50 domains, ≤30s budget.
 */
import { adminClient, authorized, startRun, finishRun, recordSourceResult, sha256Hex, dedupKey, fanout } from "../_shared/common.ts";

const FUNDING_REGEX = /(raises?|raised|secures?|closes?|lands)\s+\$?[\d.]+\s*(m|million|b|billion)/i;
const ROUND_REGEX = /(pre-?seed|seed|series [a-e]\+?)/i;
const EXEC_REGEX = /(joins|appointed|named|hires?)\s+.{0,40}(as\s+)?(chief|cto|ceo|cro|cmo|cfo|coo|vp|president)/i;

interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
}

function parseRss(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/g) ?? [];
  for (const block of itemBlocks.slice(0, 50)) {
    const title = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim();
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim();
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim();
    if (title && link) items.push({ title, link, pubDate: pubDate ?? new Date().toUTCString() });
  }
  return items;
}

Deno.serve(async (req) => {
  if (!authorized(req)) return new Response("forbidden", { status: 403 });
  const db = adminClient();
  const deadline = Date.now() + 28_000;

  const { data: sources } = await db
    .from("sources")
    .select("key, config, stats")
    .eq("kind", "rss")
    .eq("enabled", true);

  let itemsFound = 0;
  let signalsCreated = 0;

  for (const source of sources ?? []) {
    if (Date.now() > deadline) break;
    const urls: string[] = source.config?.urls ?? [];
    if (!urls.length) continue;
    const runId = await startRun(db, source.key);
    let ok = true;

    try {
      for (const url of urls) {
        const headers: Record<string, string> = { "User-Agent": "SignalAI-bot/1.0 (+https://truesignall.com/bot)" };
        const etag = source.stats?.etags?.[url];
        if (etag) headers["If-None-Match"] = etag;
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
        if (res.status === 304) continue;
        if (!res.ok) throw new Error(`${url} → ${res.status}`);

        for (const item of parseRss(await res.text())) {
          itemsFound++;
          const funding = FUNDING_REGEX.test(item.title);
          const exec = EXEC_REGEX.test(item.title);
          if (!funding && !exec) continue;   // regex-miss LLM fallback runs batched via why-lines worker

          const domain = new URL(item.link).hostname.replace(/^www\./, "");
          const occurredAt = new Date(item.pubDate);
          const { data: company } = await db
            .from("companies")
            .upsert({ domain, name: null, source: source.key }, { onConflict: "domain", ignoreDuplicates: false })
            .select("id")
            .single();
          if (!company) continue;

          const type = funding ? "funding" : "exec_change";
          const payload = funding
            ? { round: item.title.match(ROUND_REGEX)?.[0] ?? "unspecified" }
            : { evidence: "press", person_name: null };

          const hash = await sha256Hex(dedupKey(domain, type, item.link, occurredAt));
          const { data: inserted } = await db
            .from("signals")
            .upsert(
              {
                company_id: company.id,
                type,
                title: item.title.slice(0, 200),
                payload,
                source: source.key,
                source_url: item.link,
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
    } catch (err) {
      ok = false;
      await finishRun(db, runId, false, { items_found: itemsFound }, String(err));
    }
    await recordSourceResult(db, source.key, ok);
    if (ok) await finishRun(db, runId, true, { items_found: itemsFound, signals_created: signalsCreated });
  }

  return Response.json({ items_found: itemsFound, signals_created: signalsCreated });
});
