"use client";

/** <FeedFilters> — chip row: Type(multi) · Stage · Time · view (docs/02 §4, SA-04). */
import { X } from "lucide-react";
import { Chip, Select } from "@/components/ui/primitives";
import { SIGNAL_TYPES } from "@/lib/signals/taxonomy";
import { signalTypeLabel } from "./SignalTypeIcon";
import type { FeedFiltersState } from "@/lib/demo/store";

const FILTERABLE_TYPES = SIGNAL_TYPES.filter(
  (t) => !["conference", "intent_surge", "g2_activity"].includes(t),
);

export function FeedFilters({
  filters,
  onChange,
}: {
  filters: FeedFiltersState;
  onChange: (f: FeedFiltersState) => void;
}) {
  const toggleType = (t: string) => {
    const types = filters.types.includes(t)
      ? filters.types.filter((x) => x !== t)
      : [...filters.types, t];
    onChange({ ...filters, types });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {FILTERABLE_TYPES.map((t) => (
        <Chip key={t} active={filters.types.includes(t)} onClick={() => toggleType(t)}>
          {signalTypeLabel(t)}
          {filters.types.includes(t) && <X size={10} />}
        </Chip>
      ))}
      <Select
        className="ml-auto h-7 text-xs"
        value={filters.window}
        onChange={(e) => onChange({ ...filters, window: e.target.value as FeedFiltersState["window"] })}
        aria-label="Time window"
      >
        <option value="today">Today</option>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="all">All time</option>
      </Select>
    </div>
  );
}
