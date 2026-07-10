/**
 * Draft evaluation harness — docs/06 §8 (ship at M5, run before beta and on
 * any prompt edit): 25 golden signal fixtures (5/type) × P-5 → assert
 * JSON valid 100% · signal-ref ≥92% · banned phrases 0 · mean quality ≥70.
 *
 * Usage: npx tsx scripts/eval-drafts.ts
 */
import { generateDraftAction, type DraftContext } from "../app/actions/ai";
import { PROMPT_VERSION } from "../lib/ai/prompts";

type Fixture = { type: string; title: string; payload: Record<string, unknown> };

const FIXTURES: Fixture[] = [
  // funding ×5
  { type: "funding", title: "Raised $12M Series A led by Foundry", payload: { round: "Series A", amount_usd: 12_000_000, lead: "Foundry" } },
  { type: "funding", title: "Closed $4.5M seed round", payload: { round: "seed", amount_usd: 4_500_000 } },
  { type: "funding", title: "Secures $30M Series B from Insight", payload: { round: "Series B", amount_usd: 30_000_000, lead: "Insight" } },
  { type: "funding", title: "Lands $2M pre-seed", payload: { round: "pre-seed", amount_usd: 2_000_000 } },
  { type: "funding", title: "Raised $8M Series A extension", payload: { round: "Series A", amount_usd: 8_000_000 } },
  // hiring ×5
  { type: "hiring", title: "Hiring Head of Sales Ops", payload: { job_title: "Head of Sales Operations", inferred_category: "crm_revops", confidence: "high" } },
  { type: "hiring", title: "Hiring 3 SDRs in London", payload: { job_title: "SDR", inferred_category: "sales_engagement", confidence: "high" } },
  { type: "hiring", title: "Hiring VP Marketing", payload: { job_title: "VP Marketing", inferred_category: "martech", confidence: "high" } },
  { type: "hiring", title: "Hiring Data Engineer", payload: { job_title: "Data Engineer", inferred_category: "data_stack", confidence: "high" } },
  { type: "hiring", title: "Hiring Customer Success Manager", payload: { job_title: "CSM", inferred_category: "cs_tooling", confidence: "high" } },
  // exec_change ×5
  { type: "exec_change", title: "Sarah Kim joined as CTO", payload: { person_name: "Sarah Kim", new_title: "CTO" } },
  { type: "exec_change", title: "Named Alan Reyes as CRO", payload: { person_name: "Alan Reyes", new_title: "CRO" } },
  { type: "exec_change", title: "Appointed Mira Patel as CFO", payload: { person_name: "Mira Patel", new_title: "CFO" } },
  { type: "exec_change", title: "Hired Tom Fox as VP Engineering", payload: { person_name: "Tom Fox", new_title: "VP Engineering" } },
  { type: "exec_change", title: "Lena Vogt promoted to CEO", payload: { person_name: "Lena Vogt", new_title: "CEO" } },
  // pricing_visit ×5
  { type: "pricing_visit", title: "Visited your pricing page twice this week", payload: { paths: ["/pricing"], visits_7d: 2, repeat_evaluator: false } },
  { type: "pricing_visit", title: "VP Growth viewed pricing 3× in 14 days", payload: { paths: ["/pricing"], visits_7d: 3, repeat_evaluator: true } },
  { type: "pricing_visit", title: "Pricing page session, 8 minutes", payload: { paths: ["/pricing", "/customers"], visits_7d: 1, repeat_evaluator: false } },
  { type: "pricing_visit", title: "Returned to pricing after 3 weeks", payload: { paths: ["/pricing"], visits_7d: 1, repeat_evaluator: false } },
  { type: "pricing_visit", title: "Pricing + docs deep-dive session", payload: { paths: ["/pricing", "/docs"], visits_7d: 2, repeat_evaluator: false } },
  // champion_move ×5
  { type: "champion_move", title: "Marcus Webb joined as VP RevOps", payload: { contact_name: "Marcus Webb", from_company: "Solstice", to_domain: "orbit.com" } },
  { type: "champion_move", title: "Dana Reyes moved to Fathom as CMO", payload: { contact_name: "Dana Reyes", from_company: "Metric", to_domain: "fathom.com" } },
  { type: "champion_move", title: "Ravi Menon now Head of Growth at Quartz", payload: { contact_name: "Ravi Menon", from_company: "Keel", to_domain: "quartz.com" } },
  { type: "champion_move", title: "Nia Osei joined Pinewood as CEO", payload: { contact_name: "Nia Osei", from_company: "Basalt", to_domain: "pinewood.ai" } },
  { type: "champion_move", title: "Elena Ford lands at Juniper as COO", payload: { contact_name: "Elena Ford", from_company: "Solstice", to_domain: "juniper.co" } },
];

const BANNED = [
  "pick your brain", "grab a coffee", "i hope this finds you well", "quick question",
  "circle back", "touch base", "just checking in", "reaching out", "i wanted to",
  "hope you're well", "exciting", "congrats!!",
];

async function main() {
  process.stdout.write(`eval-drafts · prompt version ${PROMPT_VERSION} · ${FIXTURES.length} fixtures\n\n`);
  let validJson = 0;
  let signalRefPass = 0;
  let bannedHits = 0;
  let qualitySum = 0;

  for (const [i, fixture] of FIXTURES.entries()) {
    const ctx: DraftContext = {
      founderName: "Amin",
      wsName: "TrueSignall",
      oneLiner: "Signal AI turns buying signals into voice-matched outreach.",
      contactName: "Jordan Lee",
      contactTitle: "CEO",
      companyName: "Acme Corp",
      stage: "cold",
      priorTouches: "none",
      triggers: [{
        type: fixture.type,
        title: fixture.title,
        whyLine: "",
        occurred: new Date().toISOString(),
        sourceUrl: "https://example.com/evidence",
        payload: fixture.payload,
      }],
      painPoints: ["missed buying signals on target accounts"],
      voiceFeatures: "{}",
      exemplars: [],
    };

    try {
      const result = await generateDraftAction(ctx);
      validJson++;
      if (result.validation.signalRefPassed) signalRefPass++;
      const text = Object.values(result.sections).flat().join(" ").toLowerCase();
      const hits = BANNED.filter((b) => text.includes(b));
      bannedHits += hits.length;
      qualitySum += result.quality.score;
      process.stdout.write(
        `${String(i + 1).padStart(2)}. ${fixture.type.padEnd(14)} ref=${result.validation.signalRefPassed ? "✓" : "✗"} q=${result.quality.score}${hits.length ? ` BANNED:${hits.join(",")}` : ""}\n`,
      );
    } catch (err) {
      process.stdout.write(`${String(i + 1).padStart(2)}. ${fixture.type.padEnd(14)} FAILED: ${err}\n`);
    }
  }

  const meanQuality = qualitySum / Math.max(1, validJson);
  process.stdout.write(`\nJSON valid: ${validJson}/${FIXTURES.length} (target 100%)\n`);
  process.stdout.write(`signal-ref pass: ${((signalRefPass / FIXTURES.length) * 100).toFixed(0)}% (target ≥92%)\n`);
  process.stdout.write(`banned phrases: ${bannedHits} (target 0)\n`);
  process.stdout.write(`mean quality: ${meanQuality.toFixed(0)} (target ≥70)\n`);

  const pass =
    validJson === FIXTURES.length &&
    signalRefPass / FIXTURES.length >= 0.92 &&
    bannedHits === 0 &&
    meanQuality >= 70;
  process.stdout.write(pass ? "\n✓ EVAL PASS\n" : "\n✗ EVAL FAIL\n");
  process.exit(pass ? 0 : 1);
}

main();
