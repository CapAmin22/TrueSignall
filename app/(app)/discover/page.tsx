"use client";

/**
 * S3 · Discover — NL search + weekly suggestions (docs/02 §5, AD-01..05).
 */
import { useMemo, useState, useTransition } from "react";
import { Search, Compass, Plus, Check } from "lucide-react";
import { copy } from "@/lib/copy";
import { useDemoStore, companies, workspace } from "@/lib/demo/store";
import { computeFit } from "@/lib/scoring/fit";
import { nlSearchAction, type DiscoverFilters } from "@/app/actions/ai";
import { FitPill } from "@/components/signal/FitPill";
import { Button } from "@/components/ui/button";
import { Badge, Card, Input, Skeleton } from "@/components/ui/primitives";
import { EmptyState } from "@/components/shared/EmptyState";

export default function DiscoverPage() {
  const store = useDemoStore();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<DiscoverFilters | null>(null);
  const [searched, setSearched] = useState(false);
  const [pending, startTransition] = useTransition();

  const monitored = new Set(store.accounts.map((a) => a.company_id));

  const results = useMemo(() => {
    const scored = companies.map((c) => ({ company: c, fit: computeFit(c, workspace.icp) }));
    const filtered = !filters
      ? scored
      : scored.filter(({ company }) => {
          if (filters.industries && !filters.industries.some((i) => company.industry.includes(i.toLowerCase()))) return false;
          if (filters.company_sizes && !filters.company_sizes.includes(company.employee_range)) return false;
          if (filters.stages && !filters.stages.includes(company.stage)) return false;
          if (filters.geos && !filters.geos.map((g) => g.toUpperCase()).includes(company.hq_country)) return false;
          return true;
        });
    return filtered.sort((a, b) => b.fit.score - a.fit.score);
  }, [filters]);

  const search = () => {
    if (!query.trim()) return;
    setSearched(true);
    startTransition(async () => {
      try {
        setFilters(await nlSearchAction(query));
      } catch {
        setFilters(null);
      }
    });
  };

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-text">Discover</h1>
      <p className="mb-5 text-sm text-muted">
        Search the corpus in plain English — results ranked by ICP fit.
      </p>

      <div className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            className="h-11 pl-9 text-[15px]"
            placeholder={copy.discover.placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
        </div>
        <Button variant="primary" size="lg" onClick={search} disabled={pending}>
          Search
        </Button>
      </div>

      {filters && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span>Understood as:</span>
          {filters.industries?.map((i) => <Badge key={i} tone="primary">{i}</Badge>)}
          {filters.stages?.map((s) => <Badge key={s} tone="info">{s.replace("_", " ")}</Badge>)}
          {filters.company_sizes?.map((s) => <Badge key={s}>{s}</Badge>)}
          {filters.geos?.map((g) => <Badge key={g}>{g}</Badge>)}
        </div>
      )}

      {pending ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : searched && results.length === 0 ? (
        <EmptyState
          icon={Compass}
          title={copy.discover.nicheEmpty}
          body="The corpus grows automatically from ingestion. Import your list for guaranteed day-one coverage."
          actionLabel="Import accounts"
        />
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">Company</th>
                <th className="px-4 py-2.5 font-medium">Fit</th>
                <th className="px-4 py-2.5 font-medium">Stage</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Size</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Geo</th>
                <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Why matched</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {results.slice(0, 25).map(({ company, fit }) => (
                <tr key={company.id} className="border-b border-border/60 last:border-0 hover:bg-background/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text">{company.name}</p>
                    <p className="text-xs text-muted">{company.domain}</p>
                  </td>
                  <td className="px-4 py-3">
                    <FitPill score={fit.score} breakdown={fit.breakdown} />
                  </td>
                  <td className="px-4 py-3 capitalize text-muted">{company.stage.replace("_", " ")}</td>
                  <td className="hidden px-4 py-3 text-muted md:table-cell">{company.employee_range}</td>
                  <td className="hidden px-4 py-3 text-muted md:table-cell">{company.hq_country}</td>
                  <td className="hidden max-w-56 truncate px-4 py-3 text-xs text-muted lg:table-cell">
                    {company.description}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {monitored.has(company.id) ? (
                      <Badge tone="signal">
                        <Check size={11} />
                        {store.accounts.find((a) => a.company_id === company.id)?.status === "activating"
                          ? "Activating…"
                          : "Monitoring"}
                      </Badge>
                    ) : (
                      <Button size="sm" onClick={() => store.addAccount(company.id)}>
                        <Plus size={12} />
                        Monitor
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* AD-04 — Suggested this week */}
      <h2 className="mb-3 mt-8 text-sm font-semibold text-text">{copy.discover.suggestedTitle}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {store.suggestions.map((s) => {
          const company = companies.find((c) => c.id === s.company_id)!;
          return (
            <Card key={s.company_id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-text">{company.name}</p>
                <p className="truncate text-xs text-muted">{s.reason}</p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  store.addAccount(s.company_id);
                  store.dismissSuggestion(s.company_id);
                }}
              >
                Add
              </Button>
              <Button variant="ghost" size="sm" onClick={() => store.dismissSuggestion(s.company_id)}>
                Dismiss
              </Button>
            </Card>
          );
        })}
        {store.suggestions.length === 0 && (
          <p className="text-sm text-muted">All caught up — new suggestions land every Monday.</p>
        )}
      </div>
    </div>
  );
}
