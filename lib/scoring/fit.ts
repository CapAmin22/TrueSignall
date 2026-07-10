/**
 * Fit score — docs/05 §6, deterministic 5-dimension rubric.
 * fit = round(Σ dim_score × weight)
 * weights: industry .30, size .20, stage .20, tech .20, geo .10
 * dim scoring: exact 100 · adjacent 60 · unknown 50 · mismatch 0
 * Bands: ≥70 Strong / 40–69 Moderate / <40 Weak.
 */

export interface ICP {
  industries: string[];
  company_sizes: string[];
  stages: string[];
  seniorities?: string[];
  geos: string[];
  pain_points?: string[];
  tech?: string[];
  buyer_titles?: string[];
}

export interface CompanyFacts {
  industry?: string | null;
  employee_range?: string | null;
  stage?: string | null;
  tech_stack?: string[];
  hq_country?: string | null;
  hq_region?: string | null;
}

export interface FitDimension {
  dimension: "industry" | "size" | "stage" | "tech" | "geo";
  weight: number;
  value: string | null;
  matched: "exact" | "adjacent" | "unknown" | "mismatch";
  score: number;
}

export interface FitResult {
  score: number;
  band: "strong" | "moderate" | "weak";
  breakdown: FitDimension[];
}

const SIZE_ORDER = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];
const STAGE_ORDER = [
  "bootstrap",
  "pre_seed",
  "seed",
  "series_a",
  "series_b",
  "series_c_plus",
  "public",
];

/** Small synonym/parent adjacency map for industries — docs/05 §6. */
const INDUSTRY_ADJACENCY: Record<string, string[]> = {
  fintech: ["financial services", "payments", "banking", "insurtech"],
  "financial services": ["fintech", "payments", "banking"],
  "developer tools": ["devops", "infrastructure", "saas"],
  devops: ["developer tools", "infrastructure", "cloud"],
  martech: ["marketing", "adtech", "sales tech"],
  "sales tech": ["martech", "revtech", "crm"],
  healthtech: ["healthcare", "biotech", "medtech"],
  hrtech: ["hr", "recruiting", "people ops"],
  saas: ["b2b software", "software", "cloud"],
  "b2b saas": ["saas", "b2b software", "software"],
  cybersecurity: ["security", "infosec"],
  logistics: ["supply chain", "transportation"],
  edtech: ["education", "learning"],
  "data infrastructure": ["data", "analytics", "developer tools"],
  ecommerce: ["retail", "marketplaces"],
};

const GEO_REGIONS: Record<string, string[]> = {
  US: ["US", "CA"],
  EU: ["DE", "FR", "NL", "ES", "IT", "SE", "FI", "DK", "IE", "PL", "PT", "AT", "BE", "EU"],
  UK: ["UK", "GB"],
  APAC: ["IN", "SG", "AU", "JP", "KR", "NZ"],
  LATAM: ["BR", "MX", "AR", "CL", "CO"],
};

type MatchLevel = "exact" | "adjacent" | "unknown" | "mismatch";

const LEVEL_SCORE: Record<MatchLevel, number> = {
  exact: 100,
  adjacent: 60,
  unknown: 50,
  mismatch: 0,
};

function matchList(value: string | null | undefined, wanted: string[]): MatchLevel {
  if (!wanted.length) return "unknown";
  if (!value) return "unknown";
  const v = value.toLowerCase();
  if (wanted.some((w) => w.toLowerCase() === v)) return "exact";
  return "mismatch";
}

function matchIndustry(value: string | null | undefined, wanted: string[]): MatchLevel {
  const base = matchList(value, wanted);
  if (base !== "mismatch" || !value) return base;
  const v = value.toLowerCase();
  const adjacent = wanted.some((w) => {
    const wl = w.toLowerCase();
    return (
      INDUSTRY_ADJACENCY[wl]?.includes(v) ||
      INDUSTRY_ADJACENCY[v]?.includes(wl) ||
      v.includes(wl) ||
      wl.includes(v)
    );
  });
  return adjacent ? "adjacent" : "mismatch";
}

function matchOrdered(
  value: string | null | undefined,
  wanted: string[],
  order: string[],
): MatchLevel {
  const base = matchList(value, wanted);
  if (base !== "mismatch" || !value) return base;
  const idx = order.indexOf(value.toLowerCase());
  if (idx === -1) return "unknown";
  const adjacent = wanted.some((w) => Math.abs(order.indexOf(w.toLowerCase()) - idx) === 1);
  return adjacent ? "adjacent" : "mismatch";
}

function matchTech(stack: string[] | undefined, wanted: string[]): MatchLevel {
  if (!wanted.length) return "unknown";
  if (!stack || !stack.length) return "unknown";
  const lower = stack.map((t) => t.toLowerCase());
  return wanted.some((w) => lower.includes(w.toLowerCase())) ? "exact" : "mismatch";
}

function matchGeo(country: string | null | undefined, wanted: string[]): MatchLevel {
  if (!wanted.length) return "unknown";
  if (!country) return "unknown";
  const c = country.toUpperCase();
  if (wanted.some((w) => w.toUpperCase() === c)) return "exact";
  const regionMatch = wanted.some((w) => GEO_REGIONS[w.toUpperCase()]?.includes(c));
  return regionMatch ? "adjacent" : "mismatch";
}

export function computeFit(company: CompanyFacts, icp: ICP): FitResult {
  const dims: FitDimension[] = [
    {
      dimension: "industry",
      weight: 0.3,
      value: company.industry ?? null,
      matched: matchIndustry(company.industry, icp.industries),
      score: 0,
    },
    {
      dimension: "size",
      weight: 0.2,
      value: company.employee_range ?? null,
      matched: matchOrdered(company.employee_range, icp.company_sizes, SIZE_ORDER),
      score: 0,
    },
    {
      dimension: "stage",
      weight: 0.2,
      value: company.stage ?? null,
      matched: matchOrdered(company.stage, icp.stages, STAGE_ORDER),
      score: 0,
    },
    {
      dimension: "tech",
      weight: 0.2,
      value: company.tech_stack?.slice(0, 3).join(", ") ?? null,
      matched: matchTech(company.tech_stack, icp.tech ?? []),
      score: 0,
    },
    {
      dimension: "geo",
      weight: 0.1,
      value: company.hq_country ?? null,
      matched: matchGeo(company.hq_country, icp.geos),
      score: 0,
    },
  ];

  for (const d of dims) d.score = LEVEL_SCORE[d.matched];

  const score = Math.round(dims.reduce((acc, d) => acc + d.score * d.weight, 0));
  const band = score >= 70 ? "strong" : score >= 40 ? "moderate" : "weak";
  return { score, band, breakdown: dims };
}
