"use client";

/**
 * <ChannelGuidance> — tells the founder which channel to use and why.
 * This is the trust layer: "We captured this signal on LinkedIn, so
 * reply there — that's where the conversation context lives."
 *
 * The reasoning is visible so the founder understands the recommendation
 * isn't arbitrary — it's built on where the signal was found and the
 * warmth of the relationship.
 */
import { Mail, MessageCircle, MessageSquareShare, Phone, AtSign } from "lucide-react";
import type { ChannelRecommendation, OutreachChannel } from "@/lib/channels/recommend";
import { cn } from "@/lib/utils";

const CHANNEL_ICONS: Record<OutreachChannel, typeof Mail> = {
  email: Mail,
  linkedin_dm: MessageSquareShare,
  text: MessageCircle,
  twitter_dm: AtSign,
  call: Phone,
};

const CHANNEL_COLORS: Record<OutreachChannel, string> = {
  email: "text-primary",
  linkedin_dm: "text-[#0A66C2]",
  text: "text-signal",
  twitter_dm: "text-[#1DA1F2]",
  call: "text-text",
};

export function ChannelGuidance({
  recommendation,
  compact = false,
  showReason = true,
  className,
}: {
  recommendation: ChannelRecommendation;
  compact?: boolean;
  showReason?: boolean;
  className?: string;
}) {
  const Icon = CHANNEL_ICONS[recommendation.channel];
  const color = CHANNEL_COLORS[recommendation.channel];

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[11px] font-medium",
          color,
          className,
        )}
        title={recommendation.reason}
      >
        <Icon size={11} />
        <span>→ {recommendation.label}</span>
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-[8px] border border-border bg-background/60 px-3 py-2",
        className,
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          recommendation.channel === "linkedin_dm" ? "bg-[#0A66C2]/10" :
          recommendation.channel === "text" ? "bg-signal/10" :
          recommendation.channel === "twitter_dm" ? "bg-[#1DA1F2]/10" :
          "bg-primary/10",
        )}
      >
        <Icon size={12} className={color} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-text">
          Reach out via {recommendation.label}
          {recommendation.confidence === "high" && (
            <span className="ml-1.5 text-[10px] font-normal text-signal">● recommended</span>
          )}
        </p>
        {showReason && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
            {recommendation.reason}
          </p>
        )}
      </div>
    </div>
  );
}
