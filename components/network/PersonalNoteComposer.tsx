"use client";

/**
 * Personal note composer — the Moments action sheet. Generates a warm,
 * zero-pitch note (P-8), editable before copy/send. Marking it sent logs a
 * touch on the connection so warmth recovers.
 */
import { useEffect, useState, useTransition } from "react";
import { X, RefreshCw, Copy, Check, MessageCircle, Mail, MessageSquareShare } from "lucide-react";
import { generatePersonalNoteAction, type PersonalNote } from "@/app/actions/ai";
import { useDemoStore } from "@/lib/demo/store";
import { computeWarmth } from "@/lib/relationships/warmth";
import type { Connection, PersonalSignal } from "@/lib/relationships/types";
import { relativeTime } from "@/lib/utils";
import { copy as productCopy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton, Textarea } from "@/components/ui/primitives";

const CHANNEL_META = {
  text: { icon: MessageCircle, label: "Text message" },
  email: { icon: Mail, label: "Email" },
  linkedin_dm: { icon: MessageSquareShare, label: "LinkedIn DM" },
} as const;

export function PersonalNoteComposer({
  connection,
  moment,
  onClose,
}: {
  connection: Connection;
  moment: PersonalSignal;
  onClose: () => void;
}) {
  const store = useDemoStore();
  const [note, setNote] = useState("");
  const [channel, setChannel] = useState<PersonalNote["channel_hint"]>("text");
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const generate = () => {
    startTransition(async () => {
      try {
        const warmth = computeWarmth(connection);
        const result = await generatePersonalNoteAction({
          founderName: store.workspace.founder_name,
          connectionName: connection.full_name,
          connectionTitle: connection.title ?? "",
          band: warmth.band,
          context: connection.notes.slice(0, 140),
          momentType: moment.type,
          momentTitle: moment.title,
          momentDetail: moment.detail,
          occurred: relativeTime(moment.occurred_at),
        });
        setNote(result.note);
        setChannel(result.channel_hint);
      } catch {
        setNote("");
      }
    });
  };

  useEffect(() => {
    generate();
    // generate once on mount; Regenerate button re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyNote = () => {
    void navigator.clipboard.writeText(note);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const markSent = () => {
    store.logTouch(connection.id);
    store.setMomentStatus(moment, "acted");
    setSent(true);
    setTimeout(onClose, 900);
  };

  const ChannelIcon = CHANNEL_META[channel].icon;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-[480px] flex-col overflow-y-auto bg-surface shadow-xl max-md:max-w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text">{connection.full_name}</p>
            <p className="truncate text-xs text-muted">{moment.title}</p>
          </div>
          <Badge tone="signal" className="capitalize">{moment.type.replace(/_/g, " ")}</Badge>
          <button className="text-muted hover:text-text" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-4 p-4">
          <p className="rounded-[8px] bg-primary/5 px-3 py-2 text-xs text-muted">
            Relationship note — no pitch, no ask. The goal is only warmth; the
            business follows the trust.
          </p>

          {pending && !note ? (
            <Skeleton className="h-28 w-full" />
          ) : (
            <Textarea
              rows={5}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label="Personal note"
            />
          )}

          <div className="flex items-center gap-2 text-xs text-muted">
            <ChannelIcon size={13} />
            Suggested channel: {CHANNEL_META[channel].label}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border p-4">
          <Button size="sm" onClick={generate} disabled={pending}>
            <RefreshCw size={13} className={pending ? "animate-spin" : ""} />
            Regenerate
          </Button>
          <Button size="sm" onClick={copyNote} disabled={!note}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="primary" size="sm" className="ml-auto" onClick={markSent} disabled={!note || sent}>
            {sent ? <Check size={13} /> : null}
            {sent ? "Logged" : productCopy.moments.markSent}
          </Button>
        </div>
      </div>
    </div>
  );
}
