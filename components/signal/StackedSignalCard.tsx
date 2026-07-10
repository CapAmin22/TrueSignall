"use client";

/**
 * <StackedSignalCard> — SA-02 (docs/02 §4): header `Acme · 3 signals ·
 * combined ◔ 84 Hot`, three mini-rows, expand chevron → inline full cards;
 * primary action drafts against the stack (all signal refs passed).
 */
import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronUp, Zap, Layers } from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import { copy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { SignalTypeIcon } from "./SignalTypeIcon";
import { UrgencyRing } from "./UrgencyRing";
import { FitPill } from "./FitPill";
import { SignalCard, type FeedItem } from "./SignalCard";

export function StackedSignalCard({
  items,
  onDraftStack,
  onDraft,
  onClaim,
  onDone,
  onSnooze,
}: {
  items: FeedItem[];
  onDraftStack: (items: FeedItem[]) => void;
  onDraft: (item: FeedItem) => void;
  onClaim: (deliveryId: string) => void;
  onDone: (deliveryId: string) => void;
  onSnooze: (deliveryId: string, days: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { account, company } = items[0];
  const combined = account.urgency_score;

  return (
    <Card className={cn("hover:shadow-md hover:border-primary/30", combined >= 70 && "border-l-2 border-l-hot")}>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Layers size={16} />
        </span>
        <Link href={`/accounts/${account.id}`} className="text-sm font-semibold text-text hover:text-primary">
          {company.name}
        </Link>
        <span className="text-xs text-muted">· {items.length} signals ·</span>
        <span className="text-xs text-muted">combined</span>
        <UrgencyRing score={combined} explain={account.urgency_explain} />
        <FitPill score={account.fit_score} breakdown={account.fit_breakdown} className="ml-auto" />
      </div>

      {!expanded && (
        <div className="mt-2 space-y-1.5">
          {items.slice(0, 3).map(({ signal }) => (
            <div key={signal.id} className="flex items-center gap-2 text-sm text-text">
              <SignalTypeIcon type={signal.type} size="sm" />
              <span className="truncate">{signal.title}</span>
              <span className="ml-auto shrink-0 text-xs text-muted">
                {relativeTime(signal.occurred_at)}
              </span>
            </div>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mt-3 space-y-3 border-l-2 border-border pl-3">
          {items.map((item) => (
            <SignalCard
              key={item.delivery.id}
              item={item}
              onDraft={onDraft}
              onClaim={onClaim}
              onDone={onDone}
              onSnooze={onSnooze}
            />
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => onDraftStack(items)}>
          <Zap size={13} />
          {copy.feed.draft}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? "Collapse" : `Expand ${items.length}`}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => onDone(items.map((i) => i.delivery.id).join(","))}
        >
          {copy.feed.done} all
        </Button>
      </div>
    </Card>
  );
}
