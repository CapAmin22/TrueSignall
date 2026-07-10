/**
 * Hiring → intent-category mapping — docs/05 §5.2 (CS-02/IS-06).
 * Deterministic library first; unmapped senior titles → LLM classify (P-3b), cached.
 * Confidence: exact-title=high, keyword=med, dept-only=low.
 */

export const HIRING_CATEGORIES = [
  "crm_revops",
  "sales_engagement",
  "martech",
  "data_stack",
  "infra",
  "security",
  "ai_tooling",
  "cs_tooling",
  "fintech_back_office",
  "design_tooling",
  "hr_tooling",
  "product_tooling",
] as const;

export type HiringCategory = (typeof HIRING_CATEGORIES)[number];

interface MapEntry {
  pattern: RegExp;
  category: HiringCategory;
  confidence: "high" | "medium";
}

/** 50+ entries per spec; exact-title patterns = high, keyword = medium. */
const TITLE_MAP: MapEntry[] = [
  { pattern: /head of sales ops|revops|revenue operations/i, category: "crm_revops", confidence: "high" },
  { pattern: /sales operations (manager|lead|analyst)/i, category: "crm_revops", confidence: "high" },
  { pattern: /crm (admin|manager)/i, category: "crm_revops", confidence: "high" },
  { pattern: /deal desk/i, category: "crm_revops", confidence: "medium" },
  { pattern: /\bsdr\b|\bbdr\b|sales development|business development rep/i, category: "sales_engagement", confidence: "high" },
  { pattern: /account executive|\bae\b(?![a-z])/i, category: "sales_engagement", confidence: "medium" },
  { pattern: /head of sales|vp,? sales|sales director|cro\b|chief revenue/i, category: "sales_engagement", confidence: "high" },
  { pattern: /outbound (lead|manager)/i, category: "sales_engagement", confidence: "medium" },
  { pattern: /demand gen|growth marketing|performance marketing/i, category: "martech", confidence: "high" },
  { pattern: /marketing operations|marketing ops/i, category: "martech", confidence: "high" },
  { pattern: /content marketing|seo (manager|lead)/i, category: "martech", confidence: "medium" },
  { pattern: /head of marketing|vp,? marketing|cmo\b|chief marketing/i, category: "martech", confidence: "high" },
  { pattern: /lifecycle marketing|email marketing/i, category: "martech", confidence: "medium" },
  { pattern: /data engineer/i, category: "data_stack", confidence: "high" },
  { pattern: /analytics engineer|bi (engineer|analyst|developer)/i, category: "data_stack", confidence: "high" },
  { pattern: /head of data|data platform|chief data/i, category: "data_stack", confidence: "high" },
  { pattern: /data (analyst|scientist)/i, category: "data_stack", confidence: "medium" },
  { pattern: /devops|sre\b|site reliability|platform eng/i, category: "infra", confidence: "high" },
  { pattern: /infrastructure engineer|cloud engineer/i, category: "infra", confidence: "high" },
  { pattern: /kubernetes|terraform/i, category: "infra", confidence: "medium" },
  { pattern: /security engineer|appsec|application security/i, category: "security", confidence: "high" },
  { pattern: /ciso\b|head of security|security (lead|manager)/i, category: "security", confidence: "high" },
  { pattern: /compliance (engineer|manager)|grc\b/i, category: "security", confidence: "medium" },
  { pattern: /ml engineer|machine learning|\bai engineer\b/i, category: "ai_tooling", confidence: "high" },
  { pattern: /prompt engineer|llm\b|genai|generative ai/i, category: "ai_tooling", confidence: "high" },
  { pattern: /head of ai|ai (lead|research)/i, category: "ai_tooling", confidence: "medium" },
  { pattern: /customer success/i, category: "cs_tooling", confidence: "high" },
  { pattern: /\bcsm\b|customer experience (manager|lead)/i, category: "cs_tooling", confidence: "high" },
  { pattern: /support (engineer|lead|manager)|customer support/i, category: "cs_tooling", confidence: "medium" },
  { pattern: /onboarding (specialist|manager)/i, category: "cs_tooling", confidence: "medium" },
  { pattern: /controller|finance ops|financial operations/i, category: "fintech_back_office", confidence: "high" },
  { pattern: /accounts payable|accounts receivable|billing (specialist|manager)/i, category: "fintech_back_office", confidence: "high" },
  { pattern: /\bcfo\b|head of finance|vp,? finance/i, category: "fintech_back_office", confidence: "medium" },
  { pattern: /accountant|bookkeeper/i, category: "fintech_back_office", confidence: "medium" },
  { pattern: /product designer|ux designer|ui designer/i, category: "design_tooling", confidence: "high" },
  { pattern: /head of design|design (lead|manager|systems)/i, category: "design_tooling", confidence: "medium" },
  { pattern: /recruiter|talent acquisition/i, category: "hr_tooling", confidence: "high" },
  { pattern: /people ops|head of people|chro\b|hr (manager|generalist|business partner)/i, category: "hr_tooling", confidence: "high" },
  { pattern: /product manager|product owner/i, category: "product_tooling", confidence: "medium" },
  { pattern: /head of product|vp,? product|cpo\b|chief product/i, category: "product_tooling", confidence: "high" },
];

const DEPT_MAP: { pattern: RegExp; category: HiringCategory }[] = [
  { pattern: /sales/i, category: "sales_engagement" },
  { pattern: /marketing/i, category: "martech" },
  { pattern: /data/i, category: "data_stack" },
  { pattern: /engineering|infrastructure/i, category: "infra" },
  { pattern: /security/i, category: "security" },
  { pattern: /success|support/i, category: "cs_tooling" },
  { pattern: /finance/i, category: "fintech_back_office" },
  { pattern: /design/i, category: "design_tooling" },
  { pattern: /people|hr|talent/i, category: "hr_tooling" },
  { pattern: /product/i, category: "product_tooling" },
];

export interface HiringClassification {
  category: HiringCategory | "other";
  confidence: "high" | "medium" | "low";
}

export function classifyJobTitle(title: string, dept?: string): HiringClassification {
  for (const entry of TITLE_MAP) {
    if (entry.pattern.test(title)) {
      return { category: entry.category, confidence: entry.confidence };
    }
  }
  if (dept) {
    for (const entry of DEPT_MAP) {
      if (entry.pattern.test(dept)) {
        return { category: entry.category, confidence: "low" };
      }
    }
  }
  return { category: "other", confidence: "low" };
}
