/**
 * Signal taxonomy & payload contracts — docs/05 §1.
 * Canonical names; stored in signals.type / signals.payload.
 */

export const SIGNAL_TYPES = [
  "funding",
  "hiring",
  "exec_change",
  "tech_change",
  "news",
  "product_launch",
  "geo_expansion",
  "pricing_visit",
  "site_visit",
  "champion_move",
  "linkedin_clip",
  "conference",
  "intent_surge",
  "g2_activity",
] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number];

export interface FundingPayload {
  round: string;
  amount_usd?: number;
  currency?: string;
  investors?: string[];
  lead?: string;
}

export interface HiringPayload {
  job_title: string;
  board: string;
  job_url: string;
  location?: string;
  dept?: string;
  inferred_category: string;
  confidence: "high" | "medium" | "low";
}

export interface ExecChangePayload {
  person_name: string;
  new_title: string;
  prev_company?: string;
  evidence: string;
}

export interface TechChangePayload {
  added: string[];
  removed: string[];
  flag: "competitive" | "complementary" | "neutral";
}

export interface NewsPayload {
  headline: string;
  publisher: string;
  summary?: string;
}

export interface ProductLaunchPayload {
  name: string;
  where: "producthunt" | "press" | "newsroom";
  tagline?: string;
}

export interface GeoExpansionPayload {
  region: string;
  evidence: string;
}

export interface PricingVisitPayload {
  paths: string[];
  visits_7d: number;
  duration_s?: number;
  person?: { name: string; title: string; linkedin: string; confidence: string };
  repeat_evaluator: boolean;
}

export interface SiteVisitPayload {
  paths: string[];
  page_count: number;
  person?: { name: string; title: string; linkedin: string; confidence: string };
}

export interface ChampionMovePayload {
  contact_id: string;
  contact_name: string;
  from_company: string;
  to_domain: string;
  evidence_url: string;
}

export interface LinkedinClipPayload {
  post_url: string;
  author: string;
  excerpt: string;
  relevance: "high" | "med" | "low";
  matched_pains: string[];
}

export type SignalPayload =
  | FundingPayload
  | HiringPayload
  | ExecChangePayload
  | TechChangePayload
  | NewsPayload
  | ProductLaunchPayload
  | GeoExpansionPayload
  | PricingVisitPayload
  | SiteVisitPayload
  | ChampionMovePayload
  | LinkedinClipPayload
  | Record<string, unknown>;

export interface Signal {
  id: string;
  company_id: string;
  type: SignalType;
  title: string;
  payload: SignalPayload;
  source: string;
  source_url: string | null;
  occurred_at: string;
  detected_at: string;
  dedup_hash: string;
  why_line: string | null;
}

/** Deterministic why-line fallbacks — render until the P-4 job fills why_line (docs/06 §4). */
export const WHY_LINE_FALLBACKS: Record<string, string> = {
  funding: "New funding usually means new budget and vendor decisions within the quarter.",
  hiring: "Hiring for a role is the strongest proxy that tool evaluation is underway.",
  exec_change: "New executives spend 70% of their budget in the first 100 days.",
  tech_change: "A stack change signals active re-evaluation of adjacent tooling.",
  news: "Public momentum often precedes new initiatives and budget movement.",
  product_launch: "A launch reshuffles priorities — and the tooling behind them.",
  geo_expansion: "Expansion creates net-new operational needs in the new region.",
  pricing_visit: "Pricing-page visits signal late-stage evaluation.",
  site_visit: "Repeat visits suggest an active evaluation is underway.",
  champion_move: "A former champion is 5× warmer than a cold contact.",
  linkedin_clip: "A publicly stated pain point is an open door for a relevant reply.",
  conference: "Speaking slots reveal priorities — and travel windows for meetings.",
};
