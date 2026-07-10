/**
 * Seed corpus builder — docs/05 §6 (M2): YC public directory + Product Hunt
 * B2B topics (90d) + GitHub trending orgs + RSS backfill → target ≥8K rows.
 * Graceful skips per source; embeddings batched separately (docs/06 §7).
 *
 * Usage: npx tsx scripts/seed-corpus.ts
 */
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PRODUCTHUNT_TOKEN, GITHUB_TOKEN } = process.env;

interface CorpusRow {
  domain: string;
  name: string;
  description: string | null;
  source: string;
}

async function upsertCompanies(rows: CorpusRow[]): Promise<number> {
  if (!rows.length) return 0;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/companies?on_conflict=domain`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`upsert failed ${res.status}: ${await res.text()}`);
  return rows.length;
}

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

/** YC public company directory (Algolia-backed public JSON). */
async function seedYC(): Promise<CorpusRow[]> {
  try {
    const res = await fetch(
      "https://yc-oss.github.io/api/companies/all.json",
      { signal: AbortSignal.timeout(30_000) },
    );
    if (!res.ok) throw new Error(String(res.status));
    const data: { name: string; website?: string; one_liner?: string }[] = await res.json();
    return data
      .filter((c) => c.website)
      .map((c) => ({
        domain: normalizeDomain(c.website!),
        name: c.name,
        description: c.one_liner ?? null,
        source: "seed_yc",
      }));
  } catch (err) {
    process.stdout.write(`YC seed skipped: ${err}\n`);
    return [];
  }
}

/** Product Hunt B2B topics, last 90 days (GraphQL, free token). */
async function seedProductHunt(): Promise<CorpusRow[]> {
  if (!PRODUCTHUNT_TOKEN) {
    process.stdout.write("Product Hunt seed skipped: no PRODUCTHUNT_TOKEN\n");
    return [];
  }
  const rows: CorpusRow[] = [];
  try {
    const query = `{ posts(order: VOTES, topic: "saas", postedAfter: "${new Date(Date.now() - 90 * 86400_000).toISOString()}", first: 200) { edges { node { name tagline website } } } }`;
    const res = await fetch("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${PRODUCTHUNT_TOKEN}` },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json();
    for (const edge of data?.data?.posts?.edges ?? []) {
      const node = edge.node;
      if (node.website) {
        rows.push({
          domain: normalizeDomain(node.website),
          name: node.name,
          description: node.tagline ?? null,
          source: "seed_ph",
        });
      }
    }
  } catch (err) {
    process.stdout.write(`Product Hunt seed partial: ${err}\n`);
  }
  return rows;
}

/** GitHub orgs from trending-adjacent search (dev-tool ICPs). */
async function seedGitHub(): Promise<CorpusRow[]> {
  const rows: CorpusRow[] = [];
  try {
    const res = await fetch(
      "https://api.github.com/search/repositories?q=stars:%3E500+created:%3E2025-01-01&sort=stars&per_page=100",
      {
        headers: GITHUB_TOKEN
          ? { Authorization: `Bearer ${GITHUB_TOKEN}`, "User-Agent": "SignalAI-bot/1.0" }
          : { "User-Agent": "SignalAI-bot/1.0" },
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    for (const repo of data.items ?? []) {
      const homepage = repo.homepage as string | null;
      if (homepage?.startsWith("http")) {
        rows.push({
          domain: normalizeDomain(homepage),
          name: repo.owner?.login ?? repo.name,
          description: repo.description ?? null,
          source: "seed_gh",
        });
      }
    }
  } catch (err) {
    process.stdout.write(`GitHub seed skipped: ${err}\n`);
  }
  return rows;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    process.stdout.write("seed-corpus: SUPABASE_URL / SERVICE_ROLE_KEY not set — dry run only\n");
  }

  const [yc, ph, gh] = await Promise.all([seedYC(), seedProductHunt(), seedGitHub()]);
  const all = [...yc, ...ph, ...gh];
  const unique = Array.from(new Map(all.map((r) => [r.domain, r])).values()).filter(
    (r) => r.domain.includes("."),
  );

  process.stdout.write(
    `collected: YC ${yc.length} + PH ${ph.length} + GH ${gh.length} → ${unique.length} unique domains\n`,
  );

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    let total = 0;
    for (let i = 0; i < unique.length; i += 500) {
      total += await upsertCompanies(unique.slice(i, i + 500));
      process.stdout.write(`upserted ${total}/${unique.length}\n`);
    }
    process.stdout.write(
      total >= 8000
        ? `✓ corpus target met: ${total} rows\n`
        : `corpus at ${total} rows — RSS backfill grows it toward the 8K target\n`,
    );
  }
}

main().catch((err) => {
  process.stderr.write(`${err}\n`);
  process.exit(1);
});

export {};
