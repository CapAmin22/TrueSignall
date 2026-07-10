/**
 * Signal dedup — docs/05 §2.
 * dedup_hash = sha256(domain|type|canonical(source_url or slug(title))|yyyy-mm-dd)
 * Plus fuzzy guard: skip if same (company,type) has a signal within 24h with
 * title trigram similarity ≥ 0.7 (cross-source duplicates).
 */
import { createHash } from "crypto";

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return url.toLowerCase();
  }
}

export function dedupHash(
  domain: string,
  type: string,
  sourceUrlOrTitle: string,
  occurredAt: Date,
): string {
  const canonical = sourceUrlOrTitle.startsWith("http")
    ? canonicalUrl(sourceUrlOrTitle)
    : slugify(sourceUrlOrTitle);
  const day = occurredAt.toISOString().slice(0, 10);
  return createHash("sha256")
    .update(`${domain}|${type}|${canonical}|${day}`)
    .digest("hex");
}

function trigrams(s: string): Set<string> {
  const padded = `  ${s.toLowerCase().replace(/[^a-z0-9 ]/g, "")} `;
  const grams = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) grams.add(padded.slice(i, i + 3));
  return grams;
}

/** Postgres pg_trgm-style similarity for the 24h fuzzy guard. */
export function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const g of ta) if (tb.has(g)) shared++;
  return shared / (ta.size + tb.size - shared);
}

export const FUZZY_THRESHOLD = 0.7;

export function isFuzzyDuplicate(
  newTitle: string,
  existing: { title: string; occurred_at: string }[],
  occurredAt: Date,
): boolean {
  return existing.some(
    (e) =>
      Math.abs(occurredAt.getTime() - new Date(e.occurred_at).getTime()) <= 24 * 3_600_000 &&
      trigramSimilarity(newTitle, e.title) >= FUZZY_THRESHOLD,
  );
}
