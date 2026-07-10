"use client";

/**
 * S5 · Account detail — tabs: Overview · Signals · Contacts · Outreach · Notes
 * (docs/02 §5).
 */
import Link from "next/link";
import { use, useMemo, useState } from "react";
import { Zap, FileText, ArrowUpRight, ArrowDownLeft, Phone } from "lucide-react";
import { useDemoStore } from "@/lib/demo/store";
import { findIntroPaths } from "@/lib/relationships/intro-paths";
import { cn, relativeTime } from "@/lib/utils";
import { FitPill } from "@/components/signal/FitPill";
import { UrgencyRing } from "@/components/signal/UrgencyRing";
import { SignalTypeIcon } from "@/components/signal/SignalTypeIcon";
import { Button } from "@/components/ui/button";
import { Badge, Card, Select, Textarea } from "@/components/ui/primitives";
import { DraftComposer } from "@/components/outreach/DraftComposer";
import type { FeedItem } from "@/components/signal/SignalCard";
import type { Stage } from "@/lib/demo/types";

const TABS = ["Overview", "Signals", "Contacts", "Outreach", "Notes"] as const;

const STAGES: Stage[] = [
  "identified",
  "contacted",
  "responded",
  "meeting_booked",
  "proposal_sent",
  "closed_won",
  "closed_lost",
];

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const store = useDemoStore();
  const { companies, signals, competitors } = store;
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [composerItems, setComposerItems] = useState<FeedItem[] | null>(null);
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<{ body: string; at: string }[]>([]);

  const account = store.accounts.find((a) => a.id === id);
  const company = account ? companies.find((c) => c.id === account.company_id) : undefined;

  const accountSignals = useMemo(
    () =>
      account
        ? signals
            .filter((s) => s.company_id === account.company_id)
            .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
        : [],
    [account, signals],
  );
  const accountContacts = store.contacts.filter((c) => c.account_id === id);
  const accountMessages = store.messages
    .filter((m) => m.account_id === id)
    .sort((a, b) => b.sent_at.localeCompare(a.sent_at));

  if (!account || !company) {
    return <p className="text-sm text-muted">Account not found.</p>;
  }

  const competitiveTech = new Set(competitors.map((c) => c.name.toLowerCase()));

  const draftFromSignal = (signalId: string) => {
    const signal = accountSignals.find((s) => s.id === signalId)!;
    const delivery = store.deliveries.find((d) => d.signal_id === signalId) ?? {
      id: `d-adhoc-${signalId}`,
      account_id: account.id,
      signal_id: signalId,
      urgency: account.urgency_score,
      stack_group_id: null,
      status: "new" as const,
      claimed_by: null,
      claimed_at: null,
      snoozed_until: null,
      created_at: signal.detected_at,
    };
    setComposerItems([{ delivery, signal, account, company }]);
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text">{company.name}</h1>
          <a href={`https://${company.domain}`} target="_blank" rel="noreferrer" className="text-xs text-muted hover:text-primary">
            {company.domain} ↗
          </a>
        </div>
        <FitPill score={account.fit_score} breakdown={account.fit_breakdown} />
        <UrgencyRing score={account.urgency_score} explain={account.urgency_explain} />
        {account.re_engage && <Badge tone="hot">Re-Engage Now</Badge>}
        <div className="ml-auto flex items-center gap-2">
          <Select
            value={account.stage}
            onChange={(e) => store.setStage(account.id, e.target.value as Stage)}
            aria-label="Stage"
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
          <Button variant="primary" onClick={() => accountSignals[0] && draftFromSignal(accountSignals[0].id)}>
            <Zap size={14} />
            Draft
          </Button>
          <Link href={`/accounts/${account.id}/brief`}>
            <Button>
              <FileText size={14} />
              Brief
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-5 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            className={cn(
              "border-b-2 px-3 py-2 text-sm transition-colors",
              tab === t ? "border-primary font-medium text-primary" : "border-transparent text-muted hover:text-text",
            )}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">About</h3>
            <p className="text-sm text-text">{company.description}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div><dt className="text-muted">Industry</dt><dd className="capitalize text-text">{company.industry}</dd></div>
              <div><dt className="text-muted">Size</dt><dd className="text-text">{company.employee_range}</dd></div>
              <div><dt className="text-muted">Stage</dt><dd className="capitalize text-text">{company.stage.replace("_", " ")}</dd></div>
              <div><dt className="text-muted">HQ</dt><dd className="text-text">{company.hq_country}</dd></div>
            </dl>
          </Card>
          <Card>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Tech stack</h3>
            <div className="flex flex-wrap gap-1.5">
              {company.tech_stack.map((t) => (
                <Badge key={t} tone={competitiveTech.has(t.toLowerCase()) ? "hot" : "muted"}>
                  {t}
                  {competitiveTech.has(t.toLowerCase()) && " · competitive"}
                </Badge>
              ))}
            </div>
            <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Top contacts</h3>
            {accountContacts.slice(0, 3).map((c) => (
              <p key={c.id} className="text-sm text-text">
                {c.full_name} <span className="text-muted">· {c.title}</span>
              </p>
            ))}
            {accountContacts.length === 0 && <p className="text-xs text-muted">No contacts yet.</p>}
          </Card>
          <Card className="md:col-span-2">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Warm intros from your network
            </h3>
            {findIntroPaths(company.domain, store.connections).slice(0, 3).map((p) => (
              <p key={p.connection.id} className="mb-1.5 text-sm text-text">
                <span className="font-medium">{p.connection.full_name}</span>{" "}
                <span className="text-muted">— {p.reason}</span>
                <Badge tone={p.strength >= 60 ? "signal" : "muted"} className="ml-1.5">
                  path {p.strength}
                </Badge>
              </p>
            ))}
            {findIntroPaths(company.domain, store.connections).length === 0 && (
              <p className="text-xs text-muted">
                No direct paths yet — import more of your network to find warm doors into this
                account.
              </p>
            )}
          </Card>
        </div>
      )}

      {tab === "Signals" && (
        <div className="space-y-3">
          {accountSignals.map((s) => (
            <Card key={s.id} className="flex items-start gap-3">
              <SignalTypeIcon type={s.type} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text">{s.title}</p>
                <p className="text-xs text-muted">
                  {s.source_url ? (
                    <a href={s.source_url} target="_blank" rel="noreferrer" className="hover:text-primary">
                      {s.source.replace(/_/g, " ")} ↗
                    </a>
                  ) : (
                    s.source
                  )}{" "}
                  · occurred {relativeTime(s.occurred_at)} · detected {relativeTime(s.detected_at)}
                </p>
              </div>
              <Button size="sm" onClick={() => draftFromSignal(s.id)}>
                <Zap size={12} />
                Draft
              </Button>
            </Card>
          ))}
          {accountSignals.length === 0 && <p className="text-sm text-muted">No signals detected yet — monitoring is live.</p>}
        </div>
      )}

      {tab === "Contacts" && (
        <div className="space-y-3">
          {accountContacts.map((c) => (
            <Card key={c.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text">{c.full_name}</p>
                <p className="text-xs text-muted">
                  {c.title} · {c.email}
                </p>
              </div>
              {c.tags.map((t) => (
                <Badge key={t} tone="signal" className="capitalize">
                  {t}
                </Badge>
              ))}
              <Button size="sm" variant="ghost" onClick={() => store.tagContact(c.id, "champion")}>
                {c.tags.includes("champion") ? "Untag champion" : "Tag champion"}
              </Button>
            </Card>
          ))}
          {accountContacts.length === 0 && <p className="text-sm text-muted">No contacts yet — add from import or enrichment.</p>}
          <p className="text-xs text-muted">
            Tagging a contact Champion/Customer enables job-move tracking (PS-02).
          </p>
        </div>
      )}

      {tab === "Outreach" && (
        <div className="space-y-3">
          {accountMessages.map((m) => {
            const contact = store.contacts.find((c) => c.id === m.contact_id);
            return (
              <Card key={m.id} className="flex items-center gap-3">
                {m.direction === "outbound" ? (
                  <ArrowUpRight size={16} className="shrink-0 text-primary" />
                ) : m.direction === "inbound" ? (
                  <ArrowDownLeft size={16} className="shrink-0 text-signal" />
                ) : (
                  <Phone size={16} className="shrink-0 text-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{m.subject}</p>
                  <p className="text-xs text-muted">
                    to {contact?.full_name ?? "contact"} · {relativeTime(m.sent_at)}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <span className={cn("h-2 w-2 rounded-full", m.sent_at ? "bg-signal" : "bg-border")} title="Sent" />
                  <span className={cn("h-2 w-2 rounded-full", m.opened_at ? "bg-info" : "bg-border")} title="Opened" />
                  <span className={cn("h-2 w-2 rounded-full", m.replied_at ? "bg-primary" : "bg-border")} title="Replied" />
                </span>
              </Card>
            );
          })}
          {accountMessages.length === 0 && <p className="text-sm text-muted">No outreach yet.</p>}
          <Button variant="ghost" size="sm">
            <Phone size={13} />
            Log call
          </Button>
        </div>
      )}

      {tab === "Notes" && (
        <div className="space-y-3">
          <Textarea
            rows={3}
            placeholder="Add a note — meeting takeaways, context, next steps…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            size="sm"
            variant="primary"
            disabled={!note.trim()}
            onClick={() => {
              setNotes((n) => [{ body: note.trim(), at: new Date().toISOString() }, ...n]);
              setNote("");
            }}
          >
            Save note
          </Button>
          {notes.map((n, i) => (
            <Card key={i}>
              <p className="text-sm text-text">{n.body}</p>
              <p className="mt-1 text-xs text-muted">{relativeTime(n.at)}</p>
            </Card>
          ))}
        </div>
      )}

      {composerItems && <DraftComposer items={composerItems} onClose={() => setComposerItems(null)} />}
    </div>
  );
}
