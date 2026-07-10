"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { copy } from "@/lib/copy";

/** <LimitBanner> — 80% plan usage, links Upgrade (docs/02 §4, BL-02). */
export function LimitBanner({ meter }: { meter: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[8px] border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-text">
      <TriangleAlert size={15} className="shrink-0 text-warn" />
      <span>{copy.billing.limitBanner(meter)}</span>
      <span className="text-muted">{copy.billing.pausedNote}</span>
      <Link
        href="/settings/billing"
        className="ml-auto shrink-0 font-medium text-primary hover:underline"
      >
        Upgrade
      </Link>
    </div>
  );
}
