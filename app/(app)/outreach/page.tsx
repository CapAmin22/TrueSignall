"use client";

/**
 * S8 · Outreach analytics — KPI row + message table with status pipeline
 * (docs/02 §5, ET-02/03). Gated behind ≥20 sends.
 */
import { useMemo } from "react";
import { Lock } from "lucide-react";
import { useDemoStore, companies } from "@/lib/demo/store";
import { cn, relativeTime } from "@/lib/utils";
import { Card } from "@/components/ui/primitives";
import { EmptyState } from "@/components/shared/EmptyState";

const INDUSTRY_COLD_BASELINE = 3.4;

export default function OutreachPage() {
  const store = useDemoStore();

  const stats = useMemo(() => {
    const sent = store.messages.filter((m) => m.direction === "outbound");
    const signal = sent.filter((m) => m.is_signal_triggered);
    const nonSignal = sent.filter((m) => !m.is_signal_triggered);
    const replyRate = (list: typeof sent) =>
      list.length === 0 ? 0 : (list.filter((m) => m.replied_at).length / list.length) * 100;
    const opened = sent.filter((m) => m.opened_at).length;
    const replyHours = sent
      .filter((m) => m.replied_at)
      .map((m) => (new Date(m.replied_at!).getTime() - new Date(m.sent_at).getTime()) / 3_600_000)
      .sort((a, b) => a - b);
    const median = replyHours.length
      ? replyHours[Math.floor(replyHours.length / 2)]
      : null;
    return {
      total: sent.length,
      signalRate: replyRate(signal),
      nonSignalRate: replyRate(nonSignal),
      openRate: sent.length ? (opened / sent.length) * 100 : 0,
      medianReplyHours: median,
      sent,
    };
  }, [store.messages]);

  if (stats.total < 20) {
    return (
      <div>
        <h1 className="mb-4 text-xl font-semibold text-text">Outreach</h1>
        <EmptyState
          icon={Lock}
          title={`Unlocks after 20 sends (${stats.total}/20)`}
          body="Reply-rate comparisons need a minimum sample to mean anything."
        />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-text">Outreach</h1>

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <Card>
          <p className="text-xs text-muted">Signal-triggered reply rate</p>
          <p className="mt-1 text-2xl font-semibold text-signal">{stats.signalRate.toFixed(1)}%</p>
          <p className="text-[11px] text-muted">vs {INDUSTRY_COLD_BASELINE}% industry cold baseline</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Non-signal reply rate</p>
          <p className="mt-1 text-2xl font-semibold text-text">{stats.nonSignalRate.toFixed(1)}%</p>
          <p className="text-[11px] text-muted">your own cold sends</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Median time to reply</p>
          <p className="mt-1 text-2xl font-semibold text-text">
            {stats.medianReplyHours === null ? "—" : `${Math.round(stats.medianReplyHours)}h`}
          </p>
          <p className="text-[11px] text-muted">across {stats.total} sends</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Open rate</p>
          <p className="mt-1 text-2xl font-semibold text-text">{stats.openRate.toFixed(0)}%</p>
          <p className="text-[11px] text-muted">tracking pixel, consented</p>
        </Card>
      </div>

      <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-2.5 font-medium">Subject</th>
              <th className="px-4 py-2.5 font-medium">Account</th>
              <th className="px-4 py-2.5 font-medium">Contact</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Sent</th>
            </tr>
          </thead>
          <tbody>
            {stats.sent
              .slice()
              .sort((a, b) => b.sent_at.localeCompare(a.sent_at))
              .map((m) => {
                const account = store.accounts.find((a) => a.id === m.account_id);
                const company = account ? companies.find((c) => c.id === account.company_id) : null;
                const contact = store.contacts.find((c) => c.id === m.contact_id);
                const status = m.replied_at ? "Replied" : m.opened_at ? "Opened" : "Sent";
                return (
                  <tr key={m.id} className="border-b border-border/60 last:border-0 hover:bg-background/60">
                    <td className="px-4 py-2.5 font-medium text-text">{m.subject}</td>
                    <td className="px-4 py-2.5 text-muted">{company?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted">{contact?.full_name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          m.is_signal_triggered ? "bg-signal/10 text-signal" : "bg-border/50 text-muted",
                        )}
                      >
                        {m.is_signal_triggered ? "Signal" : "Cold"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1 text-xs text-muted">
                        <span className={cn("font-medium", status === "Replied" ? "text-primary" : status === "Opened" ? "text-info" : "text-muted")}>
                          {status}
                        </span>
                      </span>
                    </td>
                    <td className="hidden px-4 py-2.5 text-xs text-muted md:table-cell">
                      {relativeTime(m.sent_at)}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
