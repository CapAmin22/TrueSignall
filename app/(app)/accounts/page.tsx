"use client";

/**
 * S4 · Accounts — table per <AccountRow> (docs/02 §5).
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, Upload } from "lucide-react";
import { useDemoStore } from "@/lib/demo/store";
import { relativeTime } from "@/lib/utils";
import { FitPill } from "@/components/signal/FitPill";
import { UrgencyRing } from "@/components/signal/UrgencyRing";
import { SignalTypeIcon, signalTypeLabel } from "@/components/signal/SignalTypeIcon";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Input, Select } from "@/components/ui/primitives";
import { EmptyState } from "@/components/shared/EmptyState";

const STAGE_LABELS: Record<string, string> = {
  identified: "Identified",
  contacted: "Contacted",
  responded: "Responded",
  meeting_booked: "Meeting booked",
  proposal_sent: "Proposal sent",
  closed_won: "Closed won",
  closed_lost: "Closed lost",
};

export default function AccountsPage() {
  const store = useDemoStore();
  const { companies, signals, members } = store;
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");

  const rows = useMemo(() => {
    return store.accounts
      .filter((a) => a.status !== "archived")
      .flatMap((account) => {
        const company = companies.find((c) => c.id === account.company_id);
        if (!company) return [];
        const lastSignal = signals
          .filter((s) => s.company_id === account.company_id)
          .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
        return [{ account, company, lastSignal }];
      })
      .filter(({ company }) =>
        search ? company.name.toLowerCase().includes(search.toLowerCase()) || company.domain.includes(search.toLowerCase()) : true,
      )
      .filter(({ account }) => (stageFilter ? account.stage === stageFilter : true))
      .sort((a, b) => b.account.urgency_score - a.account.urgency_score);
  }, [store.accounts, companies, signals, search, stageFilter]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-text">Accounts</h1>
        <span className="text-sm text-muted">{rows.length} monitored</span>
        <div className="ml-auto flex items-center gap-2">
          <Input
            className="w-48"
            placeholder="Search accounts"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} aria-label="Stage filter">
            <option value="">All stages</option>
            {Object.entries(STAGE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Button>
            <Upload size={14} />
            Import
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No accounts match"
          body="Adjust the filters, or import a CSV to start monitoring."
          actionLabel="Import accounts"
        />
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">Company</th>
                <th className="px-4 py-2.5 font-medium">Fit</th>
                <th className="px-4 py-2.5 font-medium">Urgency</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Last signal</th>
                <th className="px-4 py-2.5 font-medium">Stage</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Owner</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ account, company, lastSignal }) => (
                <tr key={account.id} className="border-b border-border/60 last:border-0 hover:bg-background/60">
                  <td className="px-4 py-3">
                    <Link href={`/accounts/${account.id}`} className="font-medium text-text hover:text-primary">
                      {company.name}
                    </Link>
                    <p className="text-xs text-muted">{company.domain}</p>
                  </td>
                  <td className="px-4 py-3">
                    <FitPill score={account.fit_score} breakdown={account.fit_breakdown} />
                  </td>
                  <td className="px-4 py-3">
                    <UrgencyRing score={account.urgency_score} explain={account.urgency_explain} showBadge={false} />
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {lastSignal ? (
                      <span className="flex items-center gap-1.5 text-xs text-muted">
                        <SignalTypeIcon type={lastSignal.type} size="sm" />
                        {signalTypeLabel(lastSignal.type)} · {relativeTime(lastSignal.occurred_at)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={account.stage === "identified" ? "muted" : "primary"}>
                      {STAGE_LABELS[account.stage]}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {account.owner_id ? (
                      <Avatar name={members.find((m) => m.id === account.owner_id)?.full_name ?? "?"} />
                    ) : (
                      <span className="text-xs text-muted">Unassigned</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
