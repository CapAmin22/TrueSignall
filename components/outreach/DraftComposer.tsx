"use client";

/**
 * <DraftComposer> — right sheet 560px (docs/02 §4, M-1):
 * context header · editable sections with per-section ↻ regenerate (≤5) ·
 * CTA alternatives dropdown · quality hint chip · Send via Gmail ·
 * Copy for LinkedIn · follow-up toggle (3/5/7d, default 5).
 */
import { useEffect, useMemo, useState, useTransition } from "react";
import { X, RefreshCw, Send, Copy, TriangleAlert, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { copy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Badge, Select, Skeleton, Textarea } from "@/components/ui/primitives";
import { SignalTypeIcon } from "@/components/signal/SignalTypeIcon";
import {
  generateDraftAction,
  regenerateSectionAction,
  type DraftContext,
  type GeneratedDraft,
} from "@/app/actions/ai";
import type { DraftSections } from "@/lib/ai/validate";
import type { FeedItem } from "@/components/signal/SignalCard";
import { useDemoStore } from "@/lib/demo/store";
import { WHY_LINE_FALLBACKS } from "@/lib/signals/taxonomy";

const SECTION_LABELS: { key: keyof DraftSections; label: string }[] = [
  { key: "subject", label: "Subject" },
  { key: "opening", label: "Opening" },
  { key: "value_prop", label: "Value prop" },
  { key: "cta", label: "CTA" },
  { key: "signoff", label: "Sign-off" },
];

export function DraftComposer({
  items,
  onClose,
}: {
  items: FeedItem[];
  onClose: () => void;
}) {
  const store = useDemoStore();
  const [draft, setDraft] = useState<GeneratedDraft | null>(null);
  const [sections, setSections] = useState<DraftSections | null>(null);
  const [regenCounts, setRegenCounts] = useState<Record<string, number>>({});
  const [followupDays, setFollowupDays] = useState<number | null>(5);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const primary = items[0];

  const contact = useMemo(
    () =>
      store.contacts.find((c) => c.account_id === primary.account.id) ?? {
        id: "ct-unknown",
        account_id: primary.account.id,
        full_name: "the founder",
        title: "Founder",
        email: "",
        seniority: "c_suite" as const,
        tags: [],
      },
    [store.contacts, primary.account.id],
  );

  const ctx: DraftContext = useMemo(() => {
    const workspace = store.workspace;
    const priorCount = store.messages.filter((m) => m.account_id === primary.account.id).length;
    const stage =
      primary.account.re_engage
        ? "re_engage"
        : priorCount > 0
          ? "warm"
          : "cold";
    return {
      founderName: workspace.founder_name,
      wsName: workspace.name,
      oneLiner: workspace.one_liner,
      contactName: contact.full_name,
      contactTitle: contact.title,
      companyName: primary.company.name,
      stage,
      priorTouches: priorCount > 0 ? `${priorCount} prior touches` : "none",
      triggers: items.map(({ signal }) => ({
        type: signal.type,
        title: signal.title,
        whyLine: signal.why_line ?? WHY_LINE_FALLBACKS[signal.type] ?? "",
        occurred: signal.occurred_at,
        sourceUrl: signal.source_url,
        payload: signal.payload as Record<string, unknown>,
      })),
      painPoints: workspace.icp.pain_points ?? [],
      voiceFeatures: "{}",
      exemplars: [],
    };
  }, [items, primary, contact, store.messages, store.workspace]);

  useEffect(() => {
    if (!store.incrementDrafts()) {
      setError("QUOTA");
      return;
    }
    startTransition(async () => {
      try {
        const result = await generateDraftAction(ctx);
        setDraft(result);
        setSections(result.sections);
      } catch {
        setError(copy.errors.aiBusy);
      }
    });
    // generate once per open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const regenerate = (section: keyof DraftSections) => {
    if (!sections || (regenCounts[section] ?? 0) >= 5) return;
    setRegenCounts((c) => ({ ...c, [section]: (c[section] ?? 0) + 1 }));
    startTransition(async () => {
      try {
        const result = await regenerateSectionAction(ctx, sections, section);
        setDraft(result);
        setSections(result.sections);
      } catch {
        setError(copy.errors.aiBusy);
      }
    });
  };

  const send = () => {
    if (!sections) return;
    store.recordSend(primary.account.id, contact.id, sections.subject, true);
    setSent(true);
    setTimeout(onClose, 1600);
  };

  const copyForLinkedIn = () => {
    if (!sections) return;
    const text = `${sections.opening}\n\n${sections.value_prop}\n\n${sections.cta}`;
    void navigator.clipboard.writeText(text);
  };

  const quality = draft?.quality;
  const noTriggerFlag = draft && !draft.validation.signalRefPassed;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-[560px] flex-col overflow-y-auto bg-surface shadow-xl max-md:max-w-full"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={copy.composer.title}
      >
        <div className="flex items-center gap-2 border-b border-border p-4">
          <h2 className="text-sm font-semibold text-text">{copy.composer.title}</h2>
          <span className="text-xs text-muted">
            → {contact.full_name}, {contact.title} at {primary.company.name}
          </span>
          <Button variant="ghost" size="icon" className="ml-auto" onClick={onClose} aria-label="Close">
            <X size={16} />
          </Button>
        </div>

        <div className="border-b border-border bg-background/60 p-4">
          {items.map(({ signal }) => (
            <div key={signal.id} className="mb-1 flex items-center gap-2 text-sm text-text">
              <SignalTypeIcon type={signal.type} size="sm" />
              <span className="truncate">{signal.title}</span>
            </div>
          ))}
          <button
            className="mt-1 text-xs text-primary hover:underline"
            onClick={() =>
              void navigator.clipboard.writeText(
                primary.signal.why_line ?? WHY_LINE_FALLBACKS[primary.signal.type] ?? "",
              )
            }
          >
            Copy why-now
          </button>
        </div>

        <div className="flex-1 space-y-4 p-4">
          {error === "QUOTA" && (
            <div className="rounded-[8px] border border-warn/40 bg-warn/10 p-3 text-sm text-text">
              Monthly AI draft quota reached. Upgrade for more — no overage charges, ever.
            </div>
          )}
          {error && error !== "QUOTA" && (
            <div className="flex items-center gap-2 rounded-[8px] border border-border bg-background p-3 text-sm text-muted">
              <TriangleAlert size={14} className="text-warn" />
              {error}
            </div>
          )}
          {pending && !sections && (
            <div className="space-y-3">
              {SECTION_LABELS.map((s) => (
                <Skeleton key={s.key} className="h-14 w-full" />
              ))}
            </div>
          )}
          {sections &&
            SECTION_LABELS.map(({ key, label }) => (
              <div key={key}>
                <div className="mb-1 flex items-center gap-2">
                  <label className="text-xs font-medium text-muted">{label}</label>
                  <button
                    className={cn(
                      "inline-flex items-center gap-1 text-[11px] text-muted hover:text-primary",
                      (regenCounts[key] ?? 0) >= 5 && "pointer-events-none opacity-40",
                    )}
                    onClick={() => regenerate(key)}
                    aria-label={`Regenerate ${label}`}
                  >
                    <RefreshCw size={11} className={cn(pending && "animate-spin")} />
                    {copy.composer.regenerate} ({5 - (regenCounts[key] ?? 0)})
                  </button>
                </div>
                <Textarea
                  rows={key === "subject" ? 1 : key === "signoff" ? 2 : 3}
                  value={sections[key] as string}
                  onChange={(e) => setSections({ ...sections, [key]: e.target.value })}
                />
                {key === "cta" && sections.cta_alternatives.length > 0 && (
                  <Select
                    className="mt-1.5 w-full text-xs"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) setSections({ ...sections, cta: e.target.value });
                    }}
                  >
                    <option value="">Swap CTA…</option>
                    {sections.cta_alternatives.map((alt, i) => (
                      <option key={i} value={alt}>
                        {alt}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            ))}
          {noTriggerFlag && (
            <div className="flex items-center gap-2 rounded-[8px] border border-warn/40 bg-warn/10 p-2.5 text-xs text-text">
              <TriangleAlert size={13} className="text-warn" />
              {copy.composer.noTrigger}
            </div>
          )}
        </div>

        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-center gap-2">
            {quality && (
              <Badge tone={quality.score >= 70 ? "signal" : quality.score >= 50 ? "warn" : "hot"}>
                <Sparkles size={11} />
                quality {quality.score}
              </Badge>
            )}
            <label className="ml-auto flex items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={followupDays !== null}
                onChange={(e) => setFollowupDays(e.target.checked ? 5 : null)}
              />
              {copy.composer.followupLabel}
            </label>
            {followupDays !== null && (
              <Select
                className="h-7 text-xs"
                value={followupDays}
                onChange={(e) => setFollowupDays(Number(e.target.value))}
              >
                {[3, 5, 7].map((d) => (
                  <option key={d} value={d}>
                    {d}d
                  </option>
                ))}
              </Select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={send} disabled={!sections || sent}>
              <Send size={14} />
              {sent ? copy.toasts.sent(contact.full_name.split(" ")[0], primary.company.name) : copy.composer.send}
            </Button>
            <Button variant="secondary" onClick={copyForLinkedIn} disabled={!sections}>
              <Copy size={14} />
              {copy.composer.copyLinkedIn}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
