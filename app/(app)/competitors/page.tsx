"use client";

/**
 * S9 · Competitors — grid of competitor cards + per-account Competitive
 * Alerts (docs/02 §5, CI-01/02). ≤10 competitors enforced.
 */
import Link from "next/link";
import { useState } from "react";
import { Star, Swords, Plus } from "lucide-react";
import { useDemoStore } from "@/lib/demo/store";
import { normalizeDomain } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge, Card, Input } from "@/components/ui/primitives";
import type { Competitor } from "@/lib/demo/types";

export default function CompetitorsPage() {
  const store = useDemoStore();
  const { companies, signals } = store;
  const [competitors, setCompetitors] = useState<Competitor[]>(store.competitors);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");

  const add = () => {
    if (!name.trim() || !domain.trim() || competitors.length >= 10) return;
    setCompetitors((cs) => [
      ...cs,
      {
        id: `cp-${Date.now()}`,
        name: name.trim(),
        domain: normalizeDomain(domain),
        funding: "Enriching…",
        headcount: "—",
        g2_rating: 0,
        latest_news: "Enrichment runs nightly",
      },
    ]);
    setName("");
    setDomain("");
  };

  // CI-02: competitor detected in a monitored account's stack
  const alerts = store.accounts
    .map((account) => {
      const company = companies.find((c) => c.id === account.company_id);
      if (!company) return null;
      const detected = company.tech_stack.filter((t) =>
        competitors.some((c) => c.name.toLowerCase() === t.toLowerCase()),
      );
      const techSignal = signals.find(
        (s) =>
          s.company_id === company.id &&
          s.type === "tech_change" &&
          (s.payload as { flag?: string }).flag === "competitive",
      );
      return detected.length || techSignal ? { account, company, detected, techSignal } : null;
    })
    .filter(Boolean) as {
    account: (typeof store.accounts)[number];
    company: (typeof companies)[number];
    detected: string[];
    techSignal?: (typeof signals)[number];
  }[];

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-xl font-semibold text-text">Competitors</h1>
        <span className="text-xs text-muted">{competitors.length}/10</span>
      </div>
      <p className="mb-5 text-sm text-muted">
        Auto-enriched nightly. A competitor detected in an account&apos;s stack raises a red alert
        and merges a positioning angle into your next draft.
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        <Input className="w-44" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input className="w-52" placeholder="domain.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
        <Button onClick={add} disabled={competitors.length >= 10}>
          <Plus size={14} />
          Add competitor
        </Button>
      </div>

      <div className="mb-8 grid gap-3 md:grid-cols-3">
        {competitors.map((c) => (
          <Card key={c.id}>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-border/50 text-xs font-semibold text-text">
                {c.name[0]}
              </span>
              <div>
                <p className="text-sm font-semibold text-text">{c.name}</p>
                <p className="text-xs text-muted">{c.domain}</p>
              </div>
            </div>
            <dl className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between"><dt className="text-muted">Funding</dt><dd className="text-text">{c.funding}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Headcount</dt><dd className="text-text">{c.headcount}</dd></div>
              <div className="flex justify-between">
                <dt className="text-muted">G2</dt>
                <dd className="flex items-center gap-0.5 text-text">
                  <Star size={11} className="fill-warn text-warn" />
                  {c.g2_rating || "—"}
                </dd>
              </div>
            </dl>
            <p className="mt-2 border-t border-border pt-2 text-xs text-muted">{c.latest_news}</p>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 text-sm font-semibold text-text">Competitive alerts</h2>
      <div className="space-y-3">
        {alerts.map(({ account, company, detected, techSignal }) => (
          <Card key={account.id} className="border-l-2 border-l-hot">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-hot/10 text-hot">
                <Swords size={14} />
              </span>
              <Link href={`/accounts/${account.id}`} className="text-sm font-semibold text-text hover:text-primary">
                {company.name}
              </Link>
              <Badge tone="hot">Competitive Alert · high confidence</Badge>
            </div>
            <p className="mt-2 text-sm text-text">
              {techSignal ? techSignal.title : `${detected.join(", ")} detected in stack`}
            </p>
            <p className="mt-1 text-xs text-muted">
              Positioning angle: acknowledge the incumbent, lead with the one thing they can&apos;t do —
              real-time signal-to-outreach in a single flow. Merged into your next draft for this account.
            </p>
          </Card>
        ))}
        {alerts.length === 0 && (
          <p className="text-sm text-muted">No competitors detected in monitored account stacks.</p>
        )}
      </div>
    </div>
  );
}
