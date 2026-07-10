/**
 * ingest-careers — ATS board pollers (docs/05 §4: Greenhouse/Lever/Ashby/
 * Workable public JSON boards). Slug discovery happens at account-add;
 * this worker walks companies with a stored careers config.
 */
import { adminClient, authorized, startRun, finishRun, recordSourceResult, sha256Hex, dedupKey, fanout } from "../_shared/common.ts";

const ATS_FETCHERS: Record<string, (slug: string) => Promise<{ title: string; url: string }[]>> = {
  greenhouse_boards: async (slug) => {
    const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`greenhouse ${res.status}`);
    const data = await res.json();
    return (data.jobs ?? []).map((j: { title: string; absolute_url: string }) => ({ title: j.title, url: j.absolute_url }));
  },
  lever_postings: async (slug) => {
    const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`lever ${res.status}`);
    const data = await res.json();
    return (data ?? []).map((j: { text: string; hostedUrl: string }) => ({ title: j.text, url: j.hostedUrl }));
  },
  ashby_boards: async (slug) => {
    const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`ashby ${res.status}`);
    const data = await res.json();
    return (data.jobs ?? []).map((j: { title: string; jobUrl: string }) => ({ title: j.title, url: j.jobUrl }));
  },
  workable_widget: async (slug) => {
    const res = await fetch(`https://apply.workable.com/api/v1/widget/accounts/${slug}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`workable ${res.status}`);
    const data = await res.json();
    return (data.jobs ?? []).map((j: { title: string; url: string }) => ({ title: j.title, url: j.url }));
  },
};

Deno.serve(async (req) => {
  if (!authorized(req)) return new Response("forbidden", { status: 403 });
  const db = adminClient();
  const deadline = Date.now() + 28_000;
  let signalsCreated = 0;

  // Companies with discovered ATS config, monitored by ≥1 active account.
  const { data: companies } = await db
    .from("companies")
    .select("id, domain, careers_url, accounts!inner(id)")
    .not("careers_url", "is", null)
    .limit(50);

  for (const company of companies ?? []) {
    if (Date.now() > deadline) break;
    const match = company.careers_url?.match(/^ats:(\w+):(.+)$/);
    if (!match) continue;
    const [, sourceKey, slug] = match;
    const fetcher = ATS_FETCHERS[sourceKey];
    if (!fetcher) continue;

    const runId = await startRun(db, sourceKey);
    try {
      const jobs = await fetcher(slug);
      for (const job of jobs.slice(0, 30)) {
        const occurredAt = new Date();
        const hash = await sha256Hex(dedupKey(company.domain, "hiring", job.url, occurredAt));
        const { data: inserted } = await db
          .from("signals")
          .upsert(
            {
              company_id: company.id,
              type: "hiring",
              title: `Hiring ${job.title}`,
              payload: { job_title: job.title, board: sourceKey, job_url: job.url, inferred_category: "other", confidence: "low" },
              source: sourceKey,
              source_url: job.url,
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
      await recordSourceResult(db, sourceKey, true);
      await finishRun(db, runId, true, { signals_created: signalsCreated });
    } catch (err) {
      await recordSourceResult(db, sourceKey, false);
      await finishRun(db, runId, false, {}, String(err));
    }
  }

  return Response.json({ signals_created: signalsCreated });
});
