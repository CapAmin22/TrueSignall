/**
 * QA-D1 (docs/10 §6): draft opening names the trigger; 0 banned phrases;
 * length window. Validation pipeline: docs/06 §5–6.
 */
import { describe, it, expect } from "vitest";
import {
  validateDraft,
  buildTriggerKeywords,
  computeQuality,
  editDistanceRatio,
  type DraftSections,
} from "@/lib/ai/validate";
import { scanBannedPhrases } from "@/lib/copy";

const trigger = buildTriggerKeywords("funding", "Raised $12M Series A led by Foundry", {
  round: "Series A",
  amount_usd: 12_000_000,
  lead: "Foundry",
});

const goodDraft: DraftSections = {
  subject: "your series a and what's next",
  opening:
    "Saw the $12M Series A led by Foundry — that changes what the next two quarters look like for your team. New budget usually means the GTM stack gets rebuilt within ninety days of the announcement.",
  value_prop:
    "We built Signal AI so founders like you stop missing buying signals on target accounts — every funding round, hire, and pricing visit becomes a timed, personal email that lands while the window is open.",
  cta: "Open to a 15-minute intro call this week?",
  signoff: "Best,\nAmin",
  cta_alternatives: [],
};

describe("signal-reference check (docs/06 §5 step 2)", () => {
  it("passes when the opening names the round", () => {
    expect(validateDraft(goodDraft, trigger).signalRefPassed).toBe(true);
  });

  it("fails on a generic opening", () => {
    const generic = { ...goodDraft, opening: "I saw your news and thought of you." };
    const result = validateDraft(generic, trigger);
    expect(result.signalRefPassed).toBe(false);
    expect(result.flags).toContain("no_signal_reference");
  });
});

describe("banned-phrase scan (docs/06 P-5 rule 4)", () => {
  it("clean draft has zero hits", () => {
    expect(validateDraft(goodDraft, trigger).bannedPhrases).toHaveLength(0);
  });

  it("catches every banned phrase", () => {
    const text = "I hope this finds you well — quick question, can we touch base and circle back to pick your brain?";
    const hits = scanBannedPhrases(text);
    expect(hits).toContain("i hope this finds you well");
    expect(hits).toContain("quick question");
    expect(hits).toContain("touch base");
    expect(hits).toContain("circle back");
    expect(hits).toContain("pick your brain");
  });
});

describe("quality score (docs/06 §6)", () => {
  it("weights 0.35/0.30/0.20/0.15 and rewards a clean draft", () => {
    const validation = validateDraft(goodDraft, trigger);
    const quality = computeQuality(goodDraft, validation, {
      contactName: "Jordan Lee",
      contactTitle: "CEO",
      painPoints: ["missed buying signals on target accounts"],
      voicePhrases: [],
    });
    expect(quality.subscores.relevance).toBe(100);
    expect(quality.subscores.cta_clarity).toBe(100);
    expect(quality.score).toBeGreaterThanOrEqual(70);
  });

  it("two asks tank cta_clarity to 40", () => {
    const twoAsks = { ...goodDraft, cta: "Can we talk? Or should I send a deck?" };
    const validation = validateDraft(twoAsks, trigger);
    const quality = computeQuality(twoAsks, validation, { painPoints: [], voicePhrases: [] });
    expect(quality.subscores.cta_clarity).toBe(40);
  });
});

describe("DAR edit-distance (docs/06 §6)", () => {
  it("unchanged draft ratio 0 — accepted", () => {
    expect(editDistanceRatio("hello world", "hello world")).toBe(0);
  });
  it("full rewrite ratio near 1 — not accepted (>0.35)", () => {
    expect(editDistanceRatio("completely different text here", "hello world")).toBeGreaterThan(0.35);
  });
});
