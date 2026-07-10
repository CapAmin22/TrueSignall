"use client";

/**
 * <FitPill> — docs/02 §4: colored by band; hover popover shows the
 * 5-dimension breakdown with ✓/✕ and weights (AD-02).
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { FitDimension } from "@/lib/scoring/fit";

export function FitPill({
  score,
  breakdown,
  className,
}: {
  score: number;
  breakdown?: FitDimension[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const band = score >= 70 ? "strong" : score >= 40 ? "moderate" : "weak";
  const tones = {
    strong: "bg-signal/10 text-signal",
    moderate: "bg-warn/10 text-warn",
    weak: "bg-border/60 text-muted",
  };

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
          tones[band],
        )}
        aria-label={`Fit score ${score} (${band})`}
      >
        fit {score}
      </span>
      {open && breakdown && (
        <span className="absolute left-0 top-7 z-50 block w-60 rounded-[8px] border border-border bg-surface p-3 shadow-md">
          <span className="mb-1.5 block text-[11px] font-semibold text-text">
            ICP match — 5 dimensions
          </span>
          {breakdown.map((d) => (
            <span key={d.dimension} className="flex items-center justify-between gap-2 text-[11px]">
              <span className={cn(d.matched === "exact" || d.matched === "adjacent" ? "text-signal" : d.matched === "unknown" ? "text-muted" : "text-hot")}>
                {d.matched === "exact" || d.matched === "adjacent" ? "✓" : d.matched === "unknown" ? "–" : "✕"}
              </span>
              <span className="flex-1 capitalize text-muted">
                {d.dimension}
                {d.value ? `: ${d.value}` : ""}
              </span>
              <span className="tabular-nums text-muted">×{d.weight.toFixed(2)}</span>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
