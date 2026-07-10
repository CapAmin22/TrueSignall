/**
 * QA-C1 (docs/10 §6): duplicate story across two sources stored once.
 * Dedup rules: docs/05 §2.
 */
import { describe, it, expect } from "vitest";
import {
  dedupHash,
  trigramSimilarity,
  isFuzzyDuplicate,
  canonicalUrl,
  slugify,
  FUZZY_THRESHOLD,
} from "@/lib/signals/dedup";

describe("dedupHash", () => {
  const day = new Date("2026-07-09T14:00:00Z");

  it("same story URL on the same day hashes identically", () => {
    const a = dedupHash("acme.io", "funding", "https://techcrunch.com/2026/07/09/acme-series-a", day);
    const b = dedupHash("acme.io", "funding", "https://www.techcrunch.com/2026/07/09/acme-series-a/", day);
    expect(a).toBe(b);
  });

  it("different type or day produces a different hash", () => {
    const a = dedupHash("acme.io", "funding", "https://x.com/story", day);
    expect(dedupHash("acme.io", "news", "https://x.com/story", day)).not.toBe(a);
    expect(dedupHash("acme.io", "funding", "https://x.com/story", new Date("2026-07-10T00:00:00Z"))).not.toBe(a);
  });

  it("falls back to title slug when no URL", () => {
    const a = dedupHash("acme.io", "hiring", "Hiring Head of Sales Ops", day);
    const b = dedupHash("acme.io", "hiring", "Hiring Head of Sales Ops!", day);
    expect(a).toBe(b);
  });
});

describe("fuzzy cross-source guard (24h, trgm ≥0.7)", () => {
  it("TechCrunch vs Google News variants of the same story are duplicates", () => {
    const sim = trigramSimilarity(
      "Acme raises $12M Series A led by Foundry",
      "Acme raises $12M Series A round led by Foundry Group",
    );
    expect(sim).toBeGreaterThanOrEqual(FUZZY_THRESHOLD);
  });

  it("different stories are not duplicates", () => {
    const sim = trigramSimilarity(
      "Acme raises $12M Series A led by Foundry",
      "Lumenly appoints Sarah Kim as CTO",
    );
    expect(sim).toBeLessThan(FUZZY_THRESHOLD);
  });

  it("isFuzzyDuplicate respects the 24h window", () => {
    const now = new Date("2026-07-09T14:00:00Z");
    const existing = [{ title: "Acme raises $12M Series A led by Foundry", occurred_at: "2026-07-06T14:00:00Z" }];
    expect(isFuzzyDuplicate("Acme raises $12M Series A round led by Foundry", existing, now)).toBe(false);
  });
});

describe("canonicalization", () => {
  it("strips www, protocol, and trailing slash", () => {
    expect(canonicalUrl("https://www.example.com/a/b/")).toBe("example.com/a/b");
  });
  it("slugifies titles deterministically", () => {
    expect(slugify("Hiring: Head of Sales Ops!")).toBe("hiring-head-of-sales-ops");
  });
});
