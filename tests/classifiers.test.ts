/**
 * QA-C2 (docs/10 §6): "Head of Sales Ops" → hiring category crm_revops,
 * confidence high. Regex classifiers per docs/05 §5.1–5.2.
 */
import { describe, it, expect } from "vitest";
import { classifyJobTitle } from "@/lib/signals/hiring-map";
import { classifyHeadline } from "@/lib/signals/classifiers";

describe("hiring → intent mapping (docs/05 §5.2)", () => {
  it("QA-C2: Head of Sales Ops → crm_revops, high", () => {
    expect(classifyJobTitle("Head of Sales Ops")).toEqual({ category: "crm_revops", confidence: "high" });
  });

  it("maps the spec's canonical examples", () => {
    expect(classifyJobTitle("SDR").category).toBe("sales_engagement");
    expect(classifyJobTitle("Demand Gen Manager").category).toBe("martech");
    expect(classifyJobTitle("Data Engineer").category).toBe("data_stack");
    expect(classifyJobTitle("DevOps Engineer").category).toBe("infra");
    expect(classifyJobTitle("Security Engineer").category).toBe("security");
    expect(classifyJobTitle("ML Engineer").category).toBe("ai_tooling");
    expect(classifyJobTitle("Customer Success Manager").category).toBe("cs_tooling");
    expect(classifyJobTitle("Controller").category).toBe("fintech_back_office");
  });

  it("dept-only match yields low confidence", () => {
    expect(classifyJobTitle("Ninja", "Sales")).toEqual({ category: "sales_engagement", confidence: "low" });
  });

  it("unmapped titles → other/low (queued for LLM classify)", () => {
    expect(classifyJobTitle("Chief Vibes Officer")).toEqual({ category: "other", confidence: "low" });
  });
});

describe("RSS headline classifier (docs/05 §5.1)", () => {
  it("QA-C1: funding headline extracts round + amount", () => {
    const result = classifyHeadline("Acme raises $12M Series A led by Foundry");
    expect(result).toMatchObject({ isSignal: true, type: "funding", amountUsd: 12_000_000 });
    expect(result.round?.toLowerCase()).toBe("series a");
  });

  it("handles billions and 'secures'", () => {
    expect(classifyHeadline("MegaCorp secures $1.2 billion").amountUsd).toBe(1_200_000_000);
  });

  it("detects exec changes", () => {
    expect(classifyHeadline("Lumenly appoints Sarah Kim as Chief Technology Officer").type).toBe("exec_change");
    expect(classifyHeadline("Tom Fox joins Basalt as VP of Engineering").type).toBe("exec_change");
  });

  it("ignores non-signal headlines", () => {
    expect(classifyHeadline("10 trends shaping B2B SaaS in 2026").isSignal).toBe(false);
  });
});
