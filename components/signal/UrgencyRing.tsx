"use client";

/**
 * <UrgencyRing> — docs/02 §4: 20px conic ring + number; tooltip = score
 * breakdown (per-signal contribution + decay + stack bonus) from urgency_explain.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { UrgencyExplain } from "@/lib/scoring/urgency";
import { signalTypeLabel } from "./SignalTypeIcon";
import type { SignalType } from "@/lib/signals/taxonomy";

export function UrgencyRing({
  score,
  explain,
  showBadge = true,
  className,
}: {
  score: number;
  explain?: UrgencyExplain | null;
  showBadge?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const hot = score >= 70;
  const warm = score >= 40 && score < 70;
  // muted→warn→hot conic mapping 0–100 (docs/02 §2)
  const color = hot ? "var(--hot)" : warm ? "var(--warn)" : "var(--muted)";
  const deg = Math.round((score / 100) * 360);

  return (
    <span
      className={cn("relative inline-flex items-center gap-1.5", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(${color} ${deg}deg, var(--border) ${deg}deg)` }}
        aria-label={`Urgency ${score}`}
      >
        <span className="absolute inset-[3px] rounded-full bg-surface" />
      </span>
      <span className={cn("text-xs font-semibold tabular-nums", hot ? "text-hot" : warm ? "text-warn" : "text-muted")}>
        {score}
      </span>
      {showBadge && hot && (
        <span className="rounded-full bg-hot/10 px-1.5 py-0.5 text-[10px] font-semibold text-hot">
          Hot
        </span>
      )}
      {open && explain && (
        <span className="absolute right-0 top-7 z-50 block w-64 rounded-[8px] border border-border bg-surface p-3 text-left shadow-md">
          <span className="mb-1.5 block text-[11px] font-semibold text-text">
            Urgency breakdown
          </span>
          {explain.terms.slice(0, 5).map((t, i) => (
            <span key={i} className="flex justify-between text-[11px] text-muted">
              <span>
                {signalTypeLabel(t.type as SignalType)} (W{t.W} × {t.decay})
              </span>
              <span className="tabular-nums">+{t.contrib.toFixed(1)}</span>
            </span>
          ))}
          <span className="flex justify-between text-[11px] text-muted">
            <span>ICP fit multiplier</span>
            <span className="tabular-nums">×{explain.F}</span>
          </span>
          {explain.B > 0 && (
            <span className="flex justify-between text-[11px] text-muted">
              <span>Stack bonus</span>
              <span className="tabular-nums">+{explain.B}</span>
            </span>
          )}
          <span className="mt-1 flex justify-between border-t border-border pt-1 text-[11px] font-semibold text-text">
            <span>Score</span>
            <span className="tabular-nums">{explain.score}</span>
          </span>
        </span>
      )}
    </span>
  );
}
