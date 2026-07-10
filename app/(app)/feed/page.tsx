"use client";

/**
 * S2 · Signal Feed — the primary surface (docs/02 §5).
 * Sorted urgency-desc, stacked cards (SA-02), view toggle, filters,
 * keyboard shortcuts (d/e/c/s + j/k), right rail Today panel (≥1280px).
 */
import { useEffect, useMemo, useState } from "react";
import { Radio, Inbox } from "lucide-react";
import { copy } from "@/lib/copy";
import { hoursSince, cn } from "@/lib/utils";
import { useDemoStore, sources } from "@/lib/demo/store";
import type { FeedFiltersState } from "@/lib/demo/store";
import { SignalCard, type FeedItem } from "@/components/signal/SignalCard";
import { StackedSignalCard } from "@/components/signal/StackedSignalCard";
import { FeedFilters } from "@/components/signal/FeedFilters";
import { EmptyState } from "@/components/shared/EmptyState";
import { LimitBanner } from "@/components/shared/LimitBanner";
import { SourceHealthDot } from "@/components/shared/SourceHealthDot";
import { DraftComposer } from "@/components/outreach/DraftComposer";
import { Meter } from "@/components/ui/primitives";
import { PLANS, meterStatus, LIMIT_WARN_RATIO } from "@/lib/plans";

const VIEWS = ["all", "unclaimed", "snoozed", "archived"] as const;

export default function FeedPage() {
  const store = useDemoStore();
  const { companies, signals, members, workspace } = store;
  const [filters, setFilters] = useState<FeedFiltersState>({
    types: [],
    stage: null,
    window: "all",
    view: "all",
  });
  const [composerItems, setComposerItems] = useState<FeedItem[] | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);

  const items: FeedItem[] = useMemo(() => {
    return store.deliveries
      .flatMap((delivery) => {
        const signal = signals.find((s) => s.id === delivery.signal_id);
        const account = store.accounts.find((a) => a.id === delivery.account_id);
        const company = account && companies.find((c) => c.id === account.company_id);
        return signal && account && company ? [{ delivery, signal, account, company }] : [];
      })
      .filter((it) => {
        if (filters.view === "all" && ["done", "snoozed"].includes(it.delivery.status)) return false;
        if (filters.view === "unclaimed" && it.delivery.status !== "new") return false;
        if (filters.view === "snoozed" && it.delivery.status !== "snoozed") return false;
        if (filters.view === "archived" && it.delivery.status !== "done") return false;
        if (filters.types.length && !filters.types.includes(it.signal.type)) return false;
        const h = hoursSince(it.signal.detected_at);
        if (filters.window === "today" && h > 24) return false;
        if (filters.window === "7d" && h > 168) return false;
        if (filters.window === "30d" && h > 720) return false;
        return true;
      })
      .sort((a, b) => b.delivery.urgency - a.delivery.urgency);
  }, [store.deliveries, store.accounts, signals, companies, filters]);

  // group stacked deliveries (SA-02: card renders when group has ≥2 members)
  const grouped = useMemo(() => {
    const stacks = new Map<string, FeedItem[]>();
    const singles: FeedItem[] = [];
    for (const it of items) {
      if (it.delivery.stack_group_id) {
        const arr = stacks.get(it.delivery.stack_group_id) ?? [];
        arr.push(it);
        stacks.set(it.delivery.stack_group_id, arr);
      } else {
        singles.push(it);
      }
    }
    const rows: { key: string; stack?: FeedItem[]; single?: FeedItem; urgency: number }[] = [];
    for (const [key, arr] of stacks) {
      if (arr.length >= 2) rows.push({ key, stack: arr, urgency: arr[0].account.urgency_score });
      else if (arr.length === 1) rows.push({ key, single: arr[0], urgency: arr[0].delivery.urgency });
    }
    for (const s of singles) rows.push({ key: s.delivery.id, single: s, urgency: s.delivery.urgency });
    return rows.sort((a, b) => b.urgency - a.urgency);
  }, [items]);

  const markDoneIds = (idsCsv: string) => store.markDone(idsCsv.split(","));

  // keyboard shortcuts — docs/02 §6
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)) return;
      const row = grouped[focusIdx];
      const first = row?.stack?.[0] ?? row?.single;
      if (e.key === "j") setFocusIdx((i) => Math.min(grouped.length - 1, i + 1));
      if (e.key === "k") setFocusIdx((i) => Math.max(0, i - 1));
      if (!first) return;
      if (e.key === "d") setComposerItems(row.stack ?? [first]);
      if (e.key === "e") store.markDone((row.stack ?? [first]).map((x) => x.delivery.id));
      if (e.key === "c") store.claim(first.delivery.id);
      if (e.key === "s") store.snooze(first.delivery.id, 3);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [grouped, focusIdx, store]);

  const newToday = items.filter((i) => hoursSince(i.signal.detected_at) <= 24).length;
  const plan = PLANS[workspace.plan === "trial" ? "trial" : workspace.plan];
  const meters = meterStatus(plan, store.usage);
  const warned = meters.find((m) => m.ratio >= LIMIT_WARN_RATIO && m.ratio < 1);
  const topFive = items.slice(0, 5);

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-text">{copy.feed.title}</h1>
          <span className="rounded-full bg-signal/10 px-2 py-0.5 text-xs font-medium text-signal">
            {newToday} new today
          </span>
          <div className="ml-auto flex gap-1">
            {VIEWS.map((v) => (
              <button
                key={v}
                className={cn(
                  "rounded-[8px] px-2.5 py-1 text-xs capitalize",
                  filters.view === v ? "bg-primary/10 font-medium text-primary" : "text-muted hover:text-text",
                )}
                onClick={() => setFilters({ ...filters, view: v })}
              >
                {v === "all" ? "All" : v}
              </button>
            ))}
          </div>
        </div>

        {warned && (
          <div className="mb-4">
            <LimitBanner meter={warned.key} />
          </div>
        )}

        <div className="mb-4">
          <FeedFilters filters={filters} onChange={setFilters} />
        </div>

        {grouped.length === 0 ? (
          <EmptyState
            icon={filters.view === "all" ? Radio : Inbox}
            title={
              filters.view === "all"
                ? `${copy.feed.empty.replace("your accounts", `${store.accounts.length} accounts`)}`
                : `Nothing ${filters.view} right now`
            }
            body="New signals appear here in real time as sources detect them."
            actionLabel={filters.view === "all" ? copy.feed.emptyCta : undefined}
          />
        ) : (
          <div className="space-y-3">
            {grouped.map((row, idx) =>
              row.stack ? (
                <div key={row.key} className={cn(idx === focusIdx && "ring-2 ring-primary/30 rounded-[10px]")}>
                  <StackedSignalCard
                    items={row.stack}
                    onDraftStack={setComposerItems}
                    onDraft={(it) => setComposerItems([it])}
                    onClaim={store.claim}
                    onDone={markDoneIds}
                    onSnooze={store.snooze}
                  />
                </div>
              ) : (
                <div key={row.key} className={cn(idx === focusIdx && "ring-2 ring-primary/30 rounded-[10px]")}>
                  <SignalCard
                    item={row.single!}
                    onDraft={(it) => setComposerItems([it])}
                    onClaim={store.claim}
                    onDone={(id) => store.markDone([id])}
                    onSnooze={store.snooze}
                    claimedByName={
                      members.find((m) => m.id === row.single!.delivery.claimed_by)?.full_name
                    }
                  />
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {/* Right rail — Today panel (≥1280px, docs/02 S2) */}
      <aside className="hidden w-64 shrink-0 space-y-4 xl:block">
        <div className="rounded-[10px] border border-border bg-surface p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Today</h2>
          <ol className="space-y-2">
            {topFive.map((it, i) => (
              <li key={it.delivery.id} className="flex items-start gap-2 text-xs">
                <span className="font-mono text-muted">{i + 1}.</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-text">{it.company.name}</span>
                  <span className="block truncate text-muted">{it.signal.title}</span>
                </span>
                <span className={cn("ml-auto shrink-0 tabular-nums", it.delivery.urgency >= 70 ? "text-hot" : "text-muted")}>
                  {it.delivery.urgency}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-[10px] border border-border bg-surface p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Plan usage</h2>
          {meters.map((m) => (
            <div key={m.key} className="mb-2">
              <div className="mb-0.5 flex justify-between text-[11px] text-muted">
                <span className="capitalize">{m.key}</span>
                <span className="tabular-nums">
                  {m.used}/{m.limit}
                </span>
              </div>
              <Meter used={m.used} limit={m.limit} />
            </div>
          ))}
        </div>
        <div className="rounded-[10px] border border-border bg-surface p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Source health
          </h2>
          <p className="mb-2 text-[11px] text-muted">
            {sources.filter((s) => s.consecutive_failures === 0).length}/{sources.length} healthy
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sources.map((s) => (
              <SourceHealthDot
                key={s.key}
                consecutiveFailures={s.consecutive_failures}
                enabled={s.enabled}
              />
            ))}
          </div>
        </div>
      </aside>

      {composerItems && (
        <DraftComposer items={composerItems} onClose={() => setComposerItems(null)} />
      )}
    </div>
  );
}
