/**
 * Demo fixtures — the prototype's populated state (docs/04 §7 fixture intent:
 * every screen renders with data on first run). Timestamps are computed
 * relative to load time so decay/recency math stays realistic.
 */
import { computeUrgency, computeDeliveryUrgency } from "@/lib/scoring/urgency";
import { computeFit, type ICP } from "@/lib/scoring/fit";
import type {
  Account,
  Company,
  Contact,
  Competitor,
  Delivery,
  DemoSignal,
  Member,
  Message,
  SourceHealth,
  Suggestion,
  Workspace,
} from "./types";

const NOW = Date.now();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const daysAgo = (d: number) => hoursAgo(d * 24);

export const workspace: Workspace = {
  name: "TrueSignall",
  domain: "truesignall.com",
  one_liner:
    "Signal AI watches your target accounts 24/7 and turns buying signals into voice-matched outreach.",
  icp: {
    industries: ["b2b saas", "sales tech", "fintech"],
    company_sizes: ["11-50", "51-200"],
    stages: ["seed", "series_a"],
    seniorities: ["c_suite", "vp"],
    geos: ["US", "EU"],
    pain_points: [
      "missed buying signals on target accounts",
      "hours lost to manual account research",
      "cold outreach ignored by buyers",
      "no visibility into champion job moves",
    ],
    tech: ["hubspot", "salesforce", "segment"],
    buyer_titles: ["Founder & CEO", "VP Sales", "Head of Growth"],
  },
  plan: "trial",
  trial_days_left: 9,
  founder_name: "Amin",
  pricing_paths: ["/pricing"],
};

export const members: Member[] = [
  { id: "u-amin", full_name: "Amin", email: "amin@truesignall.com", role: "owner" },
  { id: "u-sara", full_name: "Sara Okafor", email: "sara@truesignall.com", role: "member" },
];

export const companies: Company[] = [
  { id: "c-acme", domain: "acme.io", name: "Acme Corp", description: "Revenue operations platform for B2B teams", industry: "sales tech", employee_range: "51-200", stage: "series_a", hq_country: "US", tech_stack: ["salesforce", "segment", "aws"], source: "user_import" },
  { id: "c-lumenly", domain: "lumenly.com", name: "Lumenly", description: "Customer analytics for product-led SaaS", industry: "b2b saas", employee_range: "11-50", stage: "seed", hq_country: "US", tech_stack: ["hubspot", "gcp", "snowflake"], source: "user_import" },
  { id: "c-basalt", domain: "basaltlabs.com", name: "Basalt Labs", description: "API infrastructure for fintech developers", industry: "fintech", employee_range: "11-50", stage: "seed", hq_country: "UK", tech_stack: ["stripe", "aws", "datadog"], source: "user_import" },
  { id: "c-nordwind", domain: "nordwind.io", name: "Nordwind", description: "Sales engagement platform for SDR teams", industry: "sales tech", employee_range: "51-200", stage: "series_a", hq_country: "DE", tech_stack: ["outreach", "salesforce", "aws"], source: "user_import" },
  { id: "c-fathom", domain: "fathommetrics.com", name: "Fathom Metrics", description: "Revenue intelligence dashboards for founders", industry: "b2b saas", employee_range: "11-50", stage: "seed", hq_country: "US", tech_stack: ["hubspot", "vercel", "postgres"], source: "user_import" },
  { id: "c-juniper", domain: "juniperdata.co", name: "Juniper Data", description: "Data pipeline observability", industry: "data infrastructure", employee_range: "51-200", stage: "series_a", hq_country: "US", tech_stack: ["snowflake", "dbt", "aws"], source: "user_import" },
  { id: "c-keelhaul", domain: "keelhaul.dev", name: "Keelhaul", description: "CI/CD security scanning for platform teams", industry: "cybersecurity", employee_range: "11-50", stage: "seed", hq_country: "US", tech_stack: ["github", "kubernetes", "gcp"], source: "user_import" },
  { id: "c-orbit", domain: "orbitpayroll.com", name: "Orbit Payroll", description: "Global payroll for distributed startups", industry: "fintech", employee_range: "201-500", stage: "series_b", hq_country: "US", tech_stack: ["salesforce", "workday", "aws"], source: "user_import" },
  { id: "c-pinewood", domain: "pinewood.ai", name: "Pinewood AI", description: "AI copilots for customer support teams", industry: "b2b saas", employee_range: "11-50", stage: "seed", hq_country: "US", tech_stack: ["intercom", "openai", "vercel"], source: "user_import" },
  { id: "c-quartz", domain: "quartzsec.com", name: "Quartz Security", description: "Compliance automation for mid-market SaaS", industry: "cybersecurity", employee_range: "51-200", stage: "series_a", hq_country: "US", tech_stack: ["aws", "okta", "datadog"], source: "user_import" },
  { id: "c-riverbed", domain: "riverbedhealth.com", name: "Riverbed Health", description: "Patient scheduling for specialty clinics", industry: "healthtech", employee_range: "51-200", stage: "series_a", hq_country: "US", tech_stack: ["salesforce", "twilio", "aws"], source: "user_import" },
  { id: "c-solstice", domain: "solsticecrm.com", name: "Solstice CRM", description: "CRM for professional services firms", industry: "b2b saas", employee_range: "51-200", stage: "series_a", hq_country: "US", tech_stack: ["hubspot", "aws", "react"], source: "user_import" },
  // Discover corpus (not yet monitored)
  { id: "c-driftline", domain: "driftline.io", name: "Driftline", description: "Usage-based billing for API companies", industry: "fintech", employee_range: "11-50", stage: "seed", hq_country: "US", tech_stack: ["stripe", "postgres", "vercel"], source: "seed_yc" },
  { id: "c-halyard", domain: "halyard.app", name: "Halyard", description: "Procurement workflows for finance teams", industry: "b2b saas", employee_range: "11-50", stage: "seed", hq_country: "US", tech_stack: ["netsuite", "aws"], source: "seed_yc" },
  { id: "c-marrow", domain: "marrowbio.com", name: "Marrow Bio", description: "Lab inventory management", industry: "healthtech", employee_range: "11-50", stage: "seed", hq_country: "US", tech_stack: ["aws", "react"], source: "seed_ph" },
  { id: "c-tidepool", domain: "tidepool.dev", name: "Tidepool", description: "Feature flag platform for mobile teams", industry: "developer tools", employee_range: "11-50", stage: "seed", hq_country: "US", tech_stack: ["gcp", "kubernetes"], source: "seed_gh" },
  { id: "c-vantage", domain: "vantagerev.com", name: "Vantage Revenue", description: "Quota planning for RevOps leaders", industry: "sales tech", employee_range: "51-200", stage: "series_a", hq_country: "US", tech_stack: ["salesforce", "snowflake"], source: "rss_funding" },
  { id: "c-westgate", domain: "westgatehq.com", name: "Westgate", description: "Vendor risk reviews for IT teams", industry: "cybersecurity", employee_range: "51-200", stage: "series_a", hq_country: "UK", tech_stack: ["okta", "aws"], source: "rss_funding" },
  { id: "c-yellowbrick", domain: "yellowbrick.so", name: "Yellowbrick", description: "Onboarding automation for CS teams", industry: "b2b saas", employee_range: "11-50", stage: "seed", hq_country: "US", tech_stack: ["hubspot", "intercom"], source: "seed_ph" },
  { id: "c-zephyrops", domain: "zephyrops.com", name: "Zephyr Ops", description: "Incident response copilot for SRE teams", industry: "developer tools", employee_range: "11-50", stage: "seed", hq_country: "US", tech_stack: ["datadog", "pagerduty", "aws"], source: "seed_gh" },
];

export const signals: DemoSignal[] = [
  // ── Acme: the stacked Hot account (3 signals inside 72h) ──
  {
    id: "s-acme-funding", company_id: "c-acme", type: "funding",
    title: "Raised $12M Series A led by Foundry",
    payload: { round: "Series A", amount_usd: 12_000_000, investors: ["Foundry", "Uncork Capital"], lead: "Foundry" },
    source: "techcrunch_rss", source_url: "https://techcrunch.com/2026/07/09/acme-series-a",
    occurred_at: hoursAgo(4), detected_at: hoursAgo(3.8),
    why_line: "Fresh capital means vendor decisions are being made right now — 71% of funded companies finalize vendors within 90 days. And they're hiring a Head of Sales Ops.",
  },
  {
    id: "s-acme-hiring", company_id: "c-acme", type: "hiring",
    title: "Hiring Head of Sales Ops",
    payload: { job_title: "Head of Sales Operations", board: "greenhouse", job_url: "https://boards.greenhouse.io/acme/jobs/100", location: "Remote (US)", dept: "Sales", inferred_category: "crm_revops", confidence: "high" },
    source: "greenhouse_boards", source_url: "https://boards.greenhouse.io/acme/jobs/100",
    occurred_at: hoursAgo(26), detected_at: hoursAgo(25),
    why_line: "A Head of Sales Ops hire means the GTM stack is being rebuilt. Hiring for a role is the strongest proxy that tool evaluation is underway.",
  },
  {
    id: "s-acme-pricing", company_id: "c-acme", type: "pricing_visit",
    title: "Visited your pricing page twice this week",
    payload: { paths: ["/pricing", "/pricing", "/customers"], visits_7d: 2, duration_s: 210, repeat_evaluator: false },
    source: "pixel", source_url: null,
    occurred_at: hoursAgo(18), detected_at: hoursAgo(17.9),
    why_line: "Someone at Acme is checking your pricing. Pricing-page visits signal late-stage evaluation.",
  },
  // ── Lumenly: exec change ──
  {
    id: "s-lumenly-exec", company_id: "c-lumenly", type: "exec_change",
    title: "Sarah Kim joined as CTO",
    payload: { person_name: "Sarah Kim", new_title: "CTO", prev_company: "Metric Labs", evidence: "press release" },
    source: "prnewswire_rss", source_url: "https://www.prnewswire.com/news/lumenly-cto",
    occurred_at: hoursAgo(9), detected_at: hoursAgo(8),
    why_line: "A new CTO rethinks the stack early. New executives spend 70% of their budget in the first 100 days.",
  },
  // ── Basalt: hiring ──
  {
    id: "s-basalt-hiring", company_id: "c-basalt", type: "hiring",
    title: "Hiring 3 SDRs in London",
    payload: { job_title: "Sales Development Representative", board: "lever", job_url: "https://jobs.lever.co/basalt/sdr", location: "London", dept: "Sales", inferred_category: "sales_engagement", confidence: "high" },
    source: "lever_postings", source_url: "https://jobs.lever.co/basalt/sdr",
    occurred_at: hoursAgo(30), detected_at: hoursAgo(29),
    why_line: "An SDR ramp means outbound volume is about to jump — and the tooling behind it is being picked now.",
  },
  // ── Nordwind: competitive tech change ──
  {
    id: "s-nordwind-tech", company_id: "c-nordwind", type: "tech_change",
    title: "Added Clay to their stack",
    payload: { added: ["Clay"], removed: [], flag: "competitive" },
    source: "tech_detect", source_url: "https://nordwind.io",
    occurred_at: hoursAgo(50), detected_at: hoursAgo(12),
    why_line: "A competitive tool just landed in their stack — the evaluation window is open but closing.",
  },
  // ── Fathom: person-identified pricing visit ──
  {
    id: "s-fathom-pricing", company_id: "c-fathom", type: "pricing_visit",
    title: "Dana Reyes (VP Growth) viewed pricing 3× in 14 days",
    payload: { paths: ["/pricing", "/pricing", "/docs", "/pricing"], visits_7d: 3, duration_s: 480, person: { name: "Dana Reyes", title: "VP Growth", linkedin: "https://linkedin.com/in/danareyes", confidence: "high" }, repeat_evaluator: true },
    source: "rb2b", source_url: null,
    occurred_at: hoursAgo(6), detected_at: hoursAgo(5.9),
    why_line: "A named VP is repeatedly on your pricing page — a Repeat Evaluator. Pricing-page visits signal late-stage evaluation.",
  },
  // ── Juniper: product launch ──
  {
    id: "s-juniper-launch", company_id: "c-juniper", type: "product_launch",
    title: "Launched Pipeline Monitor on Product Hunt",
    payload: { name: "Pipeline Monitor", where: "producthunt", tagline: "Catch broken data pipelines before your CEO does" },
    source: "producthunt_gql", source_url: "https://www.producthunt.com/posts/pipeline-monitor",
    occurred_at: hoursAgo(70), detected_at: hoursAgo(68),
    why_line: "A launch reshuffles priorities — and the tooling behind them.",
  },
  // ── Keelhaul: news ──
  {
    id: "s-keelhaul-news", company_id: "c-keelhaul", type: "news",
    title: "Named in Forbes' 25 cloud security startups to watch",
    payload: { headline: "25 cloud security startups to watch", publisher: "Forbes" },
    source: "google_news_account", source_url: "https://www.forbes.com/cloud-security-25",
    occurred_at: daysAgo(4), detected_at: daysAgo(4),
    why_line: "Public momentum often precedes new initiatives and budget movement.",
  },
  // ── Orbit: champion move ──
  {
    id: "s-orbit-champion", company_id: "c-orbit", type: "champion_move",
    title: "Marcus Webb (your champion at Solstice) joined as VP RevOps",
    payload: { contact_id: "ct-marcus", contact_name: "Marcus Webb", from_company: "Solstice CRM", to_domain: "orbitpayroll.com", evidence_url: "https://news.google.com/articles/marcus-webb-orbit" },
    source: "champion_news", source_url: "https://news.google.com/articles/marcus-webb-orbit",
    occurred_at: daysAgo(2), detected_at: daysAgo(1.8),
    why_line: "Your former champion just landed at Orbit. A former champion is 5× warmer than a cold contact.",
  },
  // ── Pinewood: linkedin clip ──
  {
    id: "s-pinewood-clip", company_id: "c-pinewood", type: "linkedin_clip",
    title: "CEO posted about drowning in manual account research",
    payload: { post_url: "https://www.linkedin.com/posts/nia-osei-pinewood", author: "Nia Osei", excerpt: "Spent my whole Sunday researching accounts by hand again. There has to be a better way to know when a target is actually ready to buy…", relevance: "high", matched_pains: ["hours lost to manual account research", "missed buying signals on target accounts"] },
    source: "clipper", source_url: "https://www.linkedin.com/posts/nia-osei-pinewood",
    occurred_at: daysAgo(1), detected_at: daysAgo(1),
    why_line: "A publicly stated pain point — in their own words — is an open door for a relevant reply.",
  },
  // ── Quartz: geo expansion ──
  {
    id: "s-quartz-geo", company_id: "c-quartz", type: "geo_expansion",
    title: "Opening EU headquarters in Dublin",
    payload: { region: "EU", evidence: "company newsroom announcement" },
    source: "google_news_account", source_url: "https://quartzsec.com/news/dublin-hq",
    occurred_at: daysAgo(5), detected_at: daysAgo(5),
    why_line: "Expansion creates net-new operational needs in the new region.",
  },
  // ── Riverbed: repeat site visits ──
  {
    id: "s-riverbed-visit", company_id: "c-riverbed", type: "site_visit",
    title: "4-page session including /customers and /docs",
    payload: { paths: ["/", "/customers", "/docs", "/blog/signal-timing"], page_count: 4 },
    source: "pixel", source_url: null,
    occurred_at: daysAgo(3), detected_at: daysAgo(3),
    why_line: "Repeat visits suggest an active evaluation is underway.",
  },
  // ── Solstice: quiet 26d, then a new CTO hire → Re-Engage Now (PM-03) ──
  {
    id: "s-solstice-exec", company_id: "c-solstice", type: "exec_change",
    title: "Hired Tomás Rivera as CTO",
    payload: { person_name: "Tomás Rivera", new_title: "CTO", prev_company: "Vantage Revenue", evidence: "press release" },
    source: "businesswire_rss", source_url: "https://www.businesswire.com/news/solstice-cto",
    occurred_at: hoursAgo(20), detected_at: hoursAgo(19),
    why_line: "A new CTO rethinks the stack early. New executives spend 70% of their budget in the first 100 days.",
  },
];

const STACKS: Record<string, string> = {
  "s-acme-funding": "stack-acme-1",
  "s-acme-hiring": "stack-acme-1",
  "s-acme-pricing": "stack-acme-1",
};

interface AccountSeed {
  id: string;
  company_id: string;
  stage: Account["stage"];
  owner_id: string | null;
  created_days_ago: number;
  last_outreach_days_ago: number | null;
  re_engage?: boolean;
}

const accountSeeds: AccountSeed[] = [
  { id: "a-acme", company_id: "c-acme", stage: "identified", owner_id: null, created_days_ago: 12, last_outreach_days_ago: null },
  { id: "a-lumenly", company_id: "c-lumenly", stage: "contacted", owner_id: "u-amin", created_days_ago: 20, last_outreach_days_ago: 2 },
  { id: "a-basalt", company_id: "c-basalt", stage: "identified", owner_id: null, created_days_ago: 15, last_outreach_days_ago: null },
  { id: "a-nordwind", company_id: "c-nordwind", stage: "contacted", owner_id: "u-sara", created_days_ago: 18, last_outreach_days_ago: 4 },
  { id: "a-fathom", company_id: "c-fathom", stage: "responded", owner_id: "u-amin", created_days_ago: 25, last_outreach_days_ago: 1 },
  { id: "a-juniper", company_id: "c-juniper", stage: "identified", owner_id: null, created_days_ago: 10, last_outreach_days_ago: null },
  { id: "a-keelhaul", company_id: "c-keelhaul", stage: "identified", owner_id: null, created_days_ago: 9, last_outreach_days_ago: null },
  { id: "a-orbit", company_id: "c-orbit", stage: "identified", owner_id: "u-amin", created_days_ago: 8, last_outreach_days_ago: null },
  { id: "a-pinewood", company_id: "c-pinewood", stage: "contacted", owner_id: "u-amin", created_days_ago: 14, last_outreach_days_ago: 6 },
  { id: "a-quartz", company_id: "c-quartz", stage: "meeting_booked", owner_id: "u-amin", created_days_ago: 30, last_outreach_days_ago: 3 },
  { id: "a-riverbed", company_id: "c-riverbed", stage: "identified", owner_id: null, created_days_ago: 22, last_outreach_days_ago: null },
  { id: "a-solstice", company_id: "c-solstice", stage: "proposal_sent", owner_id: "u-amin", created_days_ago: 45, last_outreach_days_ago: 26, re_engage: true },
];

function buildAccounts(): Account[] {
  return accountSeeds.map((seed) => {
    const company = companies.find((c) => c.id === seed.company_id)!;
    const fit = computeFit(company, workspace.icp as ICP);
    const accountSignals = signals
      .filter((s) => s.company_id === seed.company_id)
      .map((s) => ({ type: s.type, occurred_at: s.occurred_at, payload: s.payload as Record<string, unknown> }));
    const urgency = computeUrgency(accountSignals, fit.score);
    return {
      id: seed.id,
      company_id: seed.company_id,
      status: "active" as const,
      fit_score: fit.score,
      fit_breakdown: fit.breakdown,
      urgency_score: urgency.score,
      urgency_explain: urgency,
      stage: seed.stage,
      owner_id: seed.owner_id,
      created_at: daysAgo(seed.created_days_ago),
      last_outreach_at: seed.last_outreach_days_ago === null ? null : daysAgo(seed.last_outreach_days_ago),
      re_engage: seed.re_engage ?? false,
    };
  });
}

export const accounts: Account[] = buildAccounts();

function buildDeliveries(): Delivery[] {
  return signals.map((s) => {
    const account = accounts.find((a) => a.company_id === s.company_id)!;
    const stackId = STACKS[s.id] ?? null;
    const urgency = computeDeliveryUrgency(
      { type: s.type, occurred_at: s.occurred_at, payload: s.payload as Record<string, unknown> },
      account.fit_score,
      Boolean(stackId),
      account.urgency_explain?.B ?? 0,
    );
    return {
      id: `d-${s.id}`,
      account_id: account.id,
      signal_id: s.id,
      urgency,
      stack_group_id: stackId,
      status: "new" as const,
      claimed_by: null,
      claimed_at: null,
      snoozed_until: null,
      created_at: s.detected_at,
    };
  });
}

export const deliveries: Delivery[] = buildDeliveries();

export const contacts: Contact[] = [
  { id: "ct-priya", account_id: "a-acme", full_name: "Priya Shah", title: "VP Sales", email: "priya@acme.io", seniority: "vp", tags: [] },
  { id: "ct-jordan", account_id: "a-acme", full_name: "Jordan Lee", title: "CEO", email: "jordan@acme.io", seniority: "c_suite", tags: [] },
  { id: "ct-sarah", account_id: "a-lumenly", full_name: "Sarah Kim", title: "CTO", email: "sarah@lumenly.com", seniority: "c_suite", tags: [] },
  { id: "ct-dana", account_id: "a-fathom", full_name: "Dana Reyes", title: "VP Growth", email: "dana@fathommetrics.com", seniority: "vp", tags: [] },
  { id: "ct-marcus", account_id: "a-orbit", full_name: "Marcus Webb", title: "VP RevOps", email: "marcus@orbitpayroll.com", seniority: "vp", tags: ["champion"] },
  { id: "ct-nia", account_id: "a-pinewood", full_name: "Nia Osei", title: "CEO", email: "nia@pinewood.ai", seniority: "c_suite", tags: [] },
  { id: "ct-tomas", account_id: "a-solstice", full_name: "Tomás Rivera", title: "CTO", email: "tomas@solsticecrm.com", seniority: "c_suite", tags: [] },
  { id: "ct-elena", account_id: "a-solstice", full_name: "Elena Ford", title: "COO", email: "elena@solsticecrm.com", seniority: "c_suite", tags: ["customer"] },
  { id: "ct-ravi", account_id: "a-quartz", full_name: "Ravi Menon", title: "Head of Growth", email: "ravi@quartzsec.com", seniority: "director", tags: [] },
  { id: "ct-lena", account_id: "a-nordwind", full_name: "Lena Vogt", title: "VP Sales", email: "lena@nordwind.io", seniority: "vp", tags: [] },
];

/** 24 sends (analytics unlocks at 20 — ET-03): 14 signal-triggered, 10 not. */
function buildMessages(): Message[] {
  const rows: Message[] = [];
  const outcomes: { signal: boolean; opened: boolean; replied: boolean }[] = [
    { signal: true, opened: true, replied: true },
    { signal: true, opened: true, replied: true },
    { signal: true, opened: true, replied: false },
    { signal: true, opened: true, replied: true },
    { signal: true, opened: false, replied: false },
    { signal: true, opened: true, replied: false },
    { signal: true, opened: true, replied: true },
    { signal: true, opened: true, replied: false },
    { signal: true, opened: false, replied: false },
    { signal: true, opened: true, replied: false },
    { signal: true, opened: true, replied: true },
    { signal: true, opened: true, replied: false },
    { signal: true, opened: false, replied: false },
    { signal: true, opened: true, replied: false },
    { signal: false, opened: true, replied: false },
    { signal: false, opened: false, replied: false },
    { signal: false, opened: false, replied: false },
    { signal: false, opened: true, replied: false },
    { signal: false, opened: false, replied: false },
    { signal: false, opened: false, replied: false },
    { signal: false, opened: true, replied: true },
    { signal: false, opened: false, replied: false },
    { signal: false, opened: false, replied: false },
    { signal: false, opened: true, replied: false },
  ];
  const pool = [
    { account_id: "a-lumenly", contact_id: "ct-sarah", subject: "your new data stack" },
    { account_id: "a-fathom", contact_id: "ct-dana", subject: "pricing questions, answered" },
    { account_id: "a-nordwind", contact_id: "ct-lena", subject: "clay + your outbound motion" },
    { account_id: "a-pinewood", contact_id: "ct-nia", subject: "sunday research, automated" },
    { account_id: "a-quartz", contact_id: "ct-ravi", subject: "dublin expansion timing" },
    { account_id: "a-solstice", contact_id: "ct-elena", subject: "proposal follow-through" },
  ];
  outcomes.forEach((o, i) => {
    const p = pool[i % pool.length];
    const sentAt = daysAgo(28 - i);
    rows.push({
      id: `m-${i}`,
      account_id: p.account_id,
      contact_id: p.contact_id,
      direction: "outbound",
      subject: p.subject,
      snippet: "…",
      is_signal_triggered: o.signal,
      sent_at: sentAt,
      opened_at: o.opened ? new Date(new Date(sentAt).getTime() + 3 * 3_600_000).toISOString() : null,
      replied_at: o.replied ? new Date(new Date(sentAt).getTime() + 9 * 3_600_000).toISOString() : null,
    });
  });
  return rows;
}

export const messages: Message[] = buildMessages();

export const competitors: Competitor[] = [
  { id: "cp-clay", name: "Clay", domain: "clay.com", funding: "$62M Series B", headcount: "150-200", g2_rating: 4.7, latest_news: "Launched AI research agents for enterprise plans" },
  { id: "cp-commonroom", name: "Common Room", domain: "commonroom.io", funding: "$52M Series B", headcount: "100-150", g2_rating: 4.5, latest_news: "Added intent scoring across community channels" },
  { id: "cp-warmly", name: "Warmly", domain: "warmly.ai", funding: "$11M Series A", headcount: "50-100", g2_rating: 4.6, latest_news: "Expanded visitor identification to EU traffic" },
];

/** Source registry health — the 17 launch sources (docs/05 §4). */
export const sources: SourceHealth[] = [
  { key: "techcrunch_rss", kind: "rss", cadence_minutes: 15, enabled: true, last_success_minutes_ago: 8, consecutive_failures: 0, signals_today: 6 },
  { key: "finsmes_rss", kind: "rss", cadence_minutes: 15, enabled: true, last_success_minutes_ago: 11, consecutive_failures: 0, signals_today: 3 },
  { key: "eu_startups_rss", kind: "rss", cadence_minutes: 15, enabled: true, last_success_minutes_ago: 13, consecutive_failures: 0, signals_today: 2 },
  { key: "prnewswire_rss", kind: "rss", cadence_minutes: 15, enabled: true, last_success_minutes_ago: 7, consecutive_failures: 0, signals_today: 4 },
  { key: "businesswire_rss", kind: "rss", cadence_minutes: 15, enabled: true, last_success_minutes_ago: 9, consecutive_failures: 0, signals_today: 2 },
  { key: "edgar_form_d", kind: "api", cadence_minutes: 120, enabled: true, last_success_minutes_ago: 64, consecutive_failures: 0, signals_today: 1 },
  { key: "google_news_account", kind: "rss", cadence_minutes: 60, enabled: true, last_success_minutes_ago: 22, consecutive_failures: 0, signals_today: 5 },
  { key: "greenhouse_boards", kind: "api", cadence_minutes: 30, enabled: true, last_success_minutes_ago: 12, consecutive_failures: 0, signals_today: 3 },
  { key: "lever_postings", kind: "api", cadence_minutes: 30, enabled: true, last_success_minutes_ago: 14, consecutive_failures: 0, signals_today: 2 },
  { key: "ashby_boards", kind: "api", cadence_minutes: 30, enabled: true, last_success_minutes_ago: 16, consecutive_failures: 0, signals_today: 1 },
  { key: "workable_widget", kind: "api", cadence_minutes: 30, enabled: true, last_success_minutes_ago: 18, consecutive_failures: 2, signals_today: 0 },
  { key: "careers_diff", kind: "crawl", cadence_minutes: 1440, enabled: true, last_success_minutes_ago: 420, consecutive_failures: 0, signals_today: 1 },
  { key: "tech_detect", kind: "crawl", cadence_minutes: 1440, enabled: true, last_success_minutes_ago: 430, consecutive_failures: 0, signals_today: 1 },
  { key: "producthunt_gql", kind: "api", cadence_minutes: 360, enabled: true, last_success_minutes_ago: 95, consecutive_failures: 0, signals_today: 1 },
  { key: "github_events", kind: "api", cadence_minutes: 360, enabled: true, last_success_minutes_ago: 100, consecutive_failures: 0, signals_today: 0 },
  { key: "champion_news", kind: "rss", cadence_minutes: 360, enabled: true, last_success_minutes_ago: 130, consecutive_failures: 0, signals_today: 1 },
  { key: "pixel", kind: "webhook", cadence_minutes: 0, enabled: true, last_success_minutes_ago: 3, consecutive_failures: 0, signals_today: 2 },
];

export const suggestions: Suggestion[] = [
  { company_id: "c-driftline", reason: "Fit 84 — fintech, seed, US; hiring a RevOps lead this week" },
  { company_id: "c-vantage", reason: "Fit 88 — sales tech, Series A; raised $9M twelve days ago" },
  { company_id: "c-yellowbrick", reason: "Fit 78 — B2B SaaS, seed; CEO posted about outbound reply rates" },
  { company_id: "c-zephyrops", reason: "Fit 74 — matches your dev-tools buyers; trending on GitHub" },
];

export function companyById(id: string): Company | undefined {
  return companies.find((c) => c.id === id);
}
