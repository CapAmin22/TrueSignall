"use client";

/**
 * <SignalCard> — the atom of the product (docs/02 §4).
 * header: type icon · account chip → S5 · fit pill · urgency ring+badge
 * title · why-now line · provenance row (mandatory) · actions (1 primary).
 * States: default · claimed · done · snoozed · inPipeline · competitive.
 */
import Link from "next/link";
import { useState } from "react";
import { Zap, MoreHorizontal, ChevronDown } from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import { copy } from "@/lib/copy";
import { recommendSignalChannel } from "@/lib/channels/recommend";
import { SourceBadge } from "@/components/shared/SourceBadge";
import { ChannelGuidance } from "@/components/shared/ChannelGuidance";
import { WHY_LINE_FALLBACKS } from "@/lib/signals/taxonomy";
import { Button } from "@/components/ui/button";
import { Card, Avatar } from "@/components/ui/primitives";
import { SignalTypeIcon } from "./SignalTypeIcon";
import { UrgencyRing } from "./UrgencyRing";
import { FitPill } from "./FitPill";
import type { Account, Company, Delivery, DemoSignal } from "@/lib/demo/types";

export interface FeedItem {
  delivery: Delivery;
  signal: DemoSignal;
  account: Account;
  company: Company;
}

export function SignalCard({
  item,
  onDraft,
  onClaim,
  onDone,
  onSnooze,
  claimedByName,
  flash = false,
  compact = false,
}: {
  item: FeedItem;
  onDraft: (item: FeedItem) => void;
  onClaim: (deliveryId: string) => void;
  onDone: (deliveryId: string) => void;
  onSnooze: (deliveryId: string, days: number) => void;
  claimedByName?: string;
  flash?: boolean;
  compact?: boolean;
}) {
  const { delivery, signal, account, company } = item;
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const isCompetitive =
    signal.type === "tech_change" &&
    (signal.payload as { flag?: string }).flag === "competitive";
  const inPipeline = account.stage !== "identified";
  const claimed = delivery.status === "claimed";

  return (
    <Card
      className={cn(
        "hover:shadow-md hover:border-primary/30",
        flash && "feed-insert",
        isCompetitive && "border-l-2 border-l-hot",
        !isCompetitive && inPipeline && "border-l-2 border-l-launch",
        delivery.status === "done" && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2">
        <SignalTypeIcon type={signal.type} competitive={isCompetitive} />
        <Link
          href={`/accounts/${account.id}`}
          className="text-sm font-semibold text-text hover:text-primary"
        >
          {company.name} ▸
        </Link>
        <FitPill score={account.fit_score} breakdown={account.fit_breakdown} />
        <div className="ml-auto flex items-center gap-2">
          {inPipeline && (
            <span className="rounded-full bg-launch/10 px-2 py-0.5 text-[10px] font-medium text-launch">
              {copy.feed.inPipeline}
            </span>
          )}
          <UrgencyRing score={delivery.urgency} explain={account.urgency_explain} />
        </div>
      </div>

      <p className="mt-2 text-[15px] font-medium leading-snug text-text">{signal.title}</p>

      <p className="mt-1 text-sm leading-relaxed text-muted">
        Why now: {signal.why_line ?? WHY_LINE_FALLBACKS[signal.type]}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <SourceBadge source={signal.source} sourceUrl={signal.source_url} compact />
        <span>·</span>
        <span>
          {copy.feed.occurred} {relativeTime(signal.occurred_at)}
        </span>
        <span>·</span>
        <span>
          {copy.feed.detected} {relativeTime(signal.detected_at)}
        </span>
        <span>·</span>
        <ChannelGuidance
          recommendation={recommendSignalChannel(signal.type, signal.source)}
          compact
        />
      </div>

      {!compact && (
        <div className="mt-3 flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => onDraft(item)}>
            <Zap size={13} />
            {copy.feed.draft}
          </Button>
          {claimed ? (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <Avatar name={claimedByName ?? "You"} className="h-5 w-5" />
              In progress · {claimedByName ?? "You"} ·{" "}
              {delivery.claimed_at ? relativeTime(delivery.claimed_at) : "now"}
            </span>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => onClaim(delivery.id)}>
              {copy.feed.claim}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onDone(delivery.id)}>
            {copy.feed.done}
          </Button>
          <div className="relative">
            <Button variant="ghost" size="sm" onClick={() => setSnoozeOpen((o) => !o)}>
              {copy.feed.snooze}
              <ChevronDown size={12} />
            </Button>
            {snoozeOpen && (
              <div className="absolute left-0 top-8 z-40 w-32 rounded-[8px] border border-border bg-surface py-1 shadow-md">
                {[1, 3, 7].map((d) => (
                  <button
                    key={d}
                    className="block w-full px-3 py-1.5 text-left text-xs text-text hover:bg-border/40"
                    onClick={() => {
                      onSnooze(delivery.id, d);
                      setSnoozeOpen(false);
                    }}
                  >
                    {d} day{d > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" aria-label="More actions" className="ml-auto">
            <MoreHorizontal size={15} />
          </Button>
        </div>
      )}
    </Card>
  );
}
