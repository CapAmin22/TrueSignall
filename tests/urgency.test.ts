/**
 * QA-C3 (docs/10 §6): urgency hand-calc — app score matches the formula ±1.
 * Formula: docs/05 §7.
 */
import { describe, it, expect } from "vitest";
import {
  computeUrgency,
  weightFor,
  fitMultiplier,
  seniorityMultiplier,
  HOT_THRESHOLD,
} from "@/lib/scoring/urgency";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

describe("urgency weights table (docs/05 §7)", () => {
  it("matches the spec table", () => {
    expect(weightFor("funding")).toEqual({ weight: 32, halflifeHours: 168 });
    expect(weightFor("champion_move")).toEqual({ weight: 30, halflifeHours: 336 });
    expect(weightFor("exec_change")).toEqual({ weight: 26, halflifeHours: 240 });
    expect(weightFor("news")).toEqual({ weight: 8, halflifeHours: 72 });
    expect(weightFor("pricing_visit", { person: { name: "x" } }).weight).toBe(34);
    expect(weightFor("pricing_visit", {}).weight).toBe(28);
    expect(weightFor("hiring", { confidence: "high" }).weight).toBe(20);
    expect(weightFor("hiring", { confidence: "medium" }).weight).toBe(14);
    expect(weightFor("hiring", { confidence: "low" }).weight).toBe(8);
    expect(weightFor("tech_change", { flag: "competitive" }).weight).toBe(20);
    expect(weightFor("tech_change", { flag: "neutral" }).weight).toBe(14);
  });
});

describe("multipliers", () => {
  it("F = 0.6 + 0.8 × fit/100", () => {
    expect(fitMultiplier(0)).toBeCloseTo(0.6);
    expect(fitMultiplier(50)).toBeCloseTo(1.0);
    expect(fitMultiplier(100)).toBeCloseTo(1.4);
  });

  it("seniority applies to personal signals only", () => {
    expect(seniorityMultiplier("champion_move", "c_suite")).toBe(1.3);
    expect(seniorityMultiplier("champion_move", "vp")).toBe(1.15);
    expect(seniorityMultiplier("funding", "c_suite")).toBe(1.0);
  });
});

describe("computeUrgency hand-calc cases", () => {
  it("single fresh funding signal at fit 86", () => {
    // W=32 · D=0.5^(4/168)≈0.9836 · F=0.6+0.8×0.86=1.288 → 32×0.9836×1.288≈40.5, B=0
    const result = computeUrgency(
      [{ type: "funding", occurred_at: hoursAgo(4) }],
      86,
    );
    expect(result.score).toBeGreaterThanOrEqual(39);
    expect(result.score).toBeLessThanOrEqual(42);
    expect(result.B).toBe(0);
  });

  it("stacked account (3 distinct types ≤72h) gets B=20 and goes Hot", () => {
    const result = computeUrgency(
      [
        { type: "funding", occurred_at: hoursAgo(4) },
        { type: "hiring", occurred_at: hoursAgo(26), payload: { confidence: "high" } },
        { type: "pricing_visit", occurred_at: hoursAgo(18) },
      ],
      86,
    );
    expect(result.B).toBe(20);
    expect(result.score).toBeGreaterThanOrEqual(HOT_THRESHOLD);
  });

  it("stacking bonus caps at 30", () => {
    const result = computeUrgency(
      [
        { type: "funding", occurred_at: hoursAgo(1) },
        { type: "hiring", occurred_at: hoursAgo(2), payload: { confidence: "high" } },
        { type: "pricing_visit", occurred_at: hoursAgo(3) },
        { type: "exec_change", occurred_at: hoursAgo(4) },
        { type: "news", occurred_at: hoursAgo(5) },
      ],
      90,
    );
    expect(result.B).toBe(30);
  });

  it("signals older than 21 days are excluded", () => {
    const result = computeUrgency(
      [{ type: "funding", occurred_at: hoursAgo(22 * 24) }],
      86,
    );
    expect(result.score).toBe(0);
    expect(result.terms).toHaveLength(0);
  });

  it("clamps to 0..100", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      type: "funding" as const,
      occurred_at: hoursAgo(i + 1),
    }));
    expect(computeUrgency(many, 100).score).toBeLessThanOrEqual(100);
  });
});
