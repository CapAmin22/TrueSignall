/**
 * Nightly crawler — GH Actions runner (docs/03 §5.4, 05 §5.5, 11 §4).
 * Pull domain shard (Hot accounts first) → careers-page diff + tech detect →
 * POST batches to /api/ingest/batch → self-abort at --budget-min.
 *
 * Usage: npx tsx scripts/crawl.ts --shard=0 --budget-min=42
 */
import { createHash } from "crypto";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=") as [string, string]),
);
const SHARD = parseInt(args.shard ?? "0", 10);
const SHARD_COUNT = 4;
const BUDGET_MS = parseInt(args["budget-min"] ?? "42", 10) * 60_000;
const DEADLINE = Date.now() + BUDGET_MS;

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, APP_URL } = process.env;

/** Minimal open tech fingerprint rules (webappanalyzer-style, docs/05 §5.5). */
const TECH_RULES: { name: string; pattern: RegExp }[] = [
  { name: "hubspot", pattern: /js\.hs-scripts\.com|hubspot/i },
  { name: "salesforce", pattern: /force\.com|salesforce/i },
  { name: "segment", pattern: /cdn\.segment\.com/i },
  { name: "intercom", pattern: /widget\.intercom\.io/i },
  { name: "stripe", pattern: /js\.stripe\.com/i },
  { name: "google_analytics", pattern: /googletagmanager\.com|google-analytics\.com/i },
  { name: "vercel", pattern: /_vercel|vercel-insights/i },
  { name: "next.js", pattern: /_next\/static/i },
  { name: "react", pattern: /react(\.production)?(\.min)?\.js|__NEXT_DATA__/i },
  { name: "clay", pattern: /clay\.(com|run)\/widget/i },
  { name: "posthog", pattern: /app\.posthog\.com|posthog\.js/i },
  { name: "drift", pattern: /js\.driftt\.com/i },
];

interface CompanyRow {
  id: string;
  domain: string;
  careers_url: string | null;
  careers_hash: string | null;
  tech_fingerprint: string | null;
  tech_stack: string[];
}

async function supabaseGet(path: string): Promise<CompanyRow[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

async function supabasePatch(path: string, body: unknown): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
}

interface BatchItem {
  domain: string;
  type: string;
  title: string;
  payload: Record<string, unknown>;
  source_url: string | null;
  occurred_at: string;
}

async function postBatch(sourceKey: string, items: BatchItem[]): Promise<void> {
  if (!items.length) return;
  const res = await fetch(`${APP_URL}/api/ingest/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CRON_SECRET}` },
    body: JSON.stringify({ source_key: sourceKey, items }),
  });
  const result = await res.json().catch(() => ({}));
  process.stdout.write(`  ${sourceKey}: ${JSON.stringify(result)}\n`);
}

function shardOf(domain: string): number {
  return createHash("md5").update(domain).digest()[0] % SHARD_COUNT;
}

async function politeFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SignalAI-bot/1.0 (+https://truesignall.com/bot)" },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CRON_SECRET || !APP_URL) {
    process.stdout.write("crawl: env not configured — exiting cleanly\n");
    return;
  }

  const companies = await supabaseGet(
    "companies?select=id,domain,careers_url,careers_hash,tech_fingerprint,tech_stack&order=updated_at.asc&limit=400",
  );
  const mine = companies.filter((c) => shardOf(c.domain) === SHARD);
  process.stdout.write(`shard ${SHARD}: ${mine.length} domains, budget ${BUDGET_MS / 60000}min\n`);

  const hiringItems: BatchItem[] = [];
  const techItems: BatchItem[] = [];

  for (const company of mine) {
    if (Date.now() > DEADLINE) {
      process.stdout.write("budget reached — self-aborting (docs/03 §6)\n");
      break;
    }
    // rate ≤1 req/2s per host (docs/09 §5)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // careers-page diff
    if (company.careers_url && !company.careers_url.startsWith("ats:")) {
      const html = await politeFetch(company.careers_url);
      if (html) {
        const jobLinks = Array.from(
          new Set(
            (html.match(/href="([^"]*(job|career|position|opening)[^"]*)"/gi) ?? []).map((m) =>
              m.replace(/^href="|"$/g, ""),
            ),
          ),
        ).sort();
        const hash = createHash("sha256").update(jobLinks.join("|")).digest("hex");
        if (company.careers_hash && hash !== company.careers_hash) {
          hiringItems.push({
            domain: company.domain,
            type: "hiring",
            title: "New roles posted on careers page",
            payload: { job_title: "careers page change", board: "careers_diff", job_url: company.careers_url },
            source_url: company.careers_url,
            occurred_at: new Date().toISOString(),
          });
        }
        await supabasePatch(`companies?id=eq.${company.id}`, { careers_hash: hash });
      }
    }

    // tech detect
    const homepage = await politeFetch(`https://${company.domain}`);
    if (homepage) {
      const detected = TECH_RULES.filter((r) => r.pattern.test(homepage)).map((r) => r.name).sort();
      const fingerprint = createHash("sha256").update(detected.join("|")).digest("hex");
      if (company.tech_fingerprint && fingerprint !== company.tech_fingerprint) {
        const previous = new Set(company.tech_stack ?? []);
        const added = detected.filter((t) => !previous.has(t));
        const removed = (company.tech_stack ?? []).filter((t) => !detected.includes(t));
        if (added.length || removed.length) {
          techItems.push({
            domain: company.domain,
            type: "tech_change",
            title: added.length ? `Added ${added.join(", ")} to their stack` : `Removed ${removed.join(", ")}`,
            payload: { added, removed, flag: "neutral" },
            source_url: `https://${company.domain}`,
            occurred_at: new Date().toISOString(),
          });
        }
      }
      await supabasePatch(`companies?id=eq.${company.id}`, {
        tech_fingerprint: fingerprint,
        tech_stack: detected,
      });
    }
  }

  await postBatch("careers_diff", hiringItems);
  await postBatch("tech_detect", techItems);
  process.stdout.write(`done: ${hiringItems.length} hiring, ${techItems.length} tech signals\n`);
}

main().catch((err) => {
  process.stderr.write(`${err}\n`);
  process.exit(1);
});
