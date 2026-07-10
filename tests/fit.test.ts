/** Fit rubric — docs/05 §6: exact 100 · adjacent 60 · unknown 50 · mismatch 0. */
import { describe, it, expect } from "vitest";
import { computeFit, type ICP } from "@/lib/scoring/fit";

const icp: ICP = {
  industries: ["b2b saas"],
  company_sizes: ["11-50", "51-200"],
  stages: ["seed", "series_a"],
  geos: ["US"],
  tech: ["hubspot"],
};

describe("computeFit", () => {
  it("perfect match scores 100", () => {
    const result = computeFit(
      {
        industry: "b2b saas",
        employee_range: "51-200",
        stage: "series_a",
        tech_stack: ["hubspot", "aws"],
        hq_country: "US",
      },
      icp,
    );
    expect(result.score).toBe(100);
    expect(result.band).toBe("strong");
  });

  it("unknown data scores 50 per dimension, never punished as mismatch", () => {
    const result = computeFit({}, icp);
    expect(result.score).toBe(50);
    expect(result.breakdown.every((d) => d.matched === "unknown")).toBe(true);
  });

  it("adjacent stage scores 60 on that dimension", () => {
    const result = computeFit(
      { industry: "b2b saas", employee_range: "11-50", stage: "series_b", tech_stack: ["hubspot"], hq_country: "US" },
      icp,
    );
    const stageDim = result.breakdown.find((d) => d.dimension === "stage")!;
    expect(stageDim.matched).toBe("adjacent");
    expect(stageDim.score).toBe(60);
  });

  it("geo region-match counts as adjacent", () => {
    const result = computeFit(
      { industry: "b2b saas", employee_range: "11-50", stage: "seed", tech_stack: ["hubspot"], hq_country: "CA" },
      icp,
    );
    const geoDim = result.breakdown.find((d) => d.dimension === "geo")!;
    expect(geoDim.matched).toBe("adjacent");
  });

  it("weights are .30/.20/.20/.20/.10", () => {
    const result = computeFit({}, icp);
    expect(result.breakdown.map((d) => d.weight)).toEqual([0.3, 0.2, 0.2, 0.2, 0.1]);
  });

  it("bands: ≥70 strong / 40–69 moderate / <40 weak", () => {
    const weak = computeFit(
      { industry: "restaurants", employee_range: "1000+", stage: "public", tech_stack: ["sap"], hq_country: "JP" },
      icp,
    );
    expect(weak.band).toBe("weak");
  });
});
