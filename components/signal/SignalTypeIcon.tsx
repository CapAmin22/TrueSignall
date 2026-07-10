/** Signal-type icon + tint — docs/02 §2 mapping. */
import {
  Banknote,
  Briefcase,
  UserPlus,
  Cpu,
  Newspaper,
  Rocket,
  MousePointerClick,
  HeartHandshake,
  Paperclip,
  Swords,
  Globe,
  Eye,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SignalType } from "@/lib/signals/taxonomy";

const MAP: Record<string, { icon: LucideIcon; className: string; label: string }> = {
  funding: { icon: Banknote, className: "text-signal bg-signal/10", label: "Funding" },
  hiring: { icon: Briefcase, className: "text-warn bg-warn/10", label: "Hiring" },
  exec_change: { icon: UserPlus, className: "text-primary bg-primary/10", label: "Exec change" },
  tech_change: { icon: Cpu, className: "text-info bg-info/10", label: "Tech change" },
  news: { icon: Newspaper, className: "text-muted bg-border/50", label: "News" },
  product_launch: { icon: Rocket, className: "text-launch bg-launch/10", label: "Launch" },
  geo_expansion: { icon: Globe, className: "text-launch bg-launch/10", label: "Geo expansion" },
  pricing_visit: { icon: MousePointerClick, className: "text-info bg-info/10", label: "Pricing visit" },
  site_visit: { icon: Eye, className: "text-info bg-info/10", label: "Site visit" },
  champion_move: { icon: HeartHandshake, className: "text-signal bg-signal/10", label: "Champion move" },
  linkedin_clip: { icon: Paperclip, className: "text-clip bg-clip/10", label: "Clip" },
  competitive: { icon: Swords, className: "text-hot bg-hot/10", label: "Competitive" },
};

export function signalTypeLabel(type: SignalType): string {
  return MAP[type]?.label ?? type;
}

export function SignalTypeIcon({
  type,
  competitive = false,
  size = "md",
}: {
  type: SignalType;
  competitive?: boolean;
  size?: "sm" | "md";
}) {
  const entry = competitive ? MAP.competitive : (MAP[type] ?? MAP.news);
  const Icon = entry.icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        size === "md" ? "h-8 w-8" : "h-6 w-6",
        entry.className,
      )}
      aria-label={entry.label}
    >
      <Icon size={size === "md" ? 16 : 13} />
    </span>
  );
}
