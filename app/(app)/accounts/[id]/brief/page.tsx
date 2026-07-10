"use client";

/**
 * S6 · Pre-call brief — clean reading page, max-width 640, <BriefSection>
 * sections, refresh ≤30s, print stylesheet (docs/02 §5, PC-01/02).
 */
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, RefreshCw, Printer } from "lucide-react";
import { useDemoStore } from "@/lib/demo/store";
import { relativeTime } from "@/lib/utils";
import { copy } from "@/lib/copy";
import { generateBriefAction, type Brief } from "@/app/actions/ai";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";

function BriefSection({
  title,
  children,
  freshness,
}: {
  title: string;
  children: React.ReactNode;
  freshness?: string;
}) {
  return (
    <section className="mb-6">
      <div className="mb-1.5 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {freshness && <span className="text-[11px] text-muted">{freshness}</span>}
      </div>
      <div className="text-sm leading-relaxed text-text">{children}</div>
    </section>
  );
}

export default function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const store = useDemoStore();
  const { companies, signals, competitors, workspace } = store;
  const [brief, setBrief] = useState<Brief | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
  const accountMessages = store.messages.filter((m) => m.account_id === id);

  const generate = useCallback(() => {
    if (!account || !company) return;
    startTransition(async () => {
      const detectedCompetitors = company.tech_stack.filter((t) =>
        competitors.some((c) => c.name.toLowerCase() === t.toLowerCase()),
      );
      const result = await generateBriefAction({
        companyFacts: `${company.name} (${company.domain}) — ${company.description}; ${company.employee_range} people; ${company.stage}`,
        signals: accountSignals
          .map((s) => `${s.title} (${relativeTime(s.occurred_at)}, ${s.source_url ?? s.source})`)
          .join("; "),
        contacts: accountContacts.map((c) => `${c.full_name}, ${c.title}${c.tags.length ? ` [${c.tags.join(",")}]` : ""}`).join("; "),
        history: accountMessages.length
          ? `${accountMessages.length} sends, ${accountMessages.filter((m) => m.replied_at).length} replies`
          : "none",
        oneLiner: workspace.one_liner,
        pains: workspace.icp.pain_points ?? [],
        competitors: detectedCompetitors.join(", "),
      });
      setBrief(result);
      setGeneratedAt(new Date().toISOString());
    });
  }, [account, company, accountSignals, accountContacts, accountMessages, competitors, workspace]);

  useEffect(() => {
    generate();
    // generate on first mount only; Refresh regenerates (6h cache in production)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!account || !company) return <p className="text-sm text-muted">Account not found.</p>;

  const freshness = generatedAt ? `generated ${relativeTime(generatedAt)}` : undefined;

  return (
    <div className="mx-auto max-w-[640px]">
      <div className="no-print mb-5 flex items-center gap-2">
        <Link href={`/accounts/${account.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft size={13} />
            {company.name}
          </Button>
        </Link>
        <div className="ml-auto flex gap-2">
          <Button size="sm" onClick={generate} disabled={pending}>
            <RefreshCw size={13} className={pending ? "animate-spin" : ""} />
            {copy.brief.refresh}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => window.print()}>
            <Printer size={13} />
            Print
          </Button>
        </div>
      </div>

      <h1 className="mb-6 text-xl font-semibold text-text">
        Pre-call brief — {company.name}
      </h1>

      {pending && !brief ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : brief ? (
        <>
          <BriefSection title={copy.brief.whyTitle} freshness={freshness}>
            <p className={brief.why_this_conversation === copy.brief.coldNotice ? "text-muted" : ""}>
              {brief.why_this_conversation}
            </p>
            {accountSignals.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-muted">
                {accountSignals.slice(0, 4).map((s) => (
                  <li key={s.id}>
                    • {s.title} — {relativeTime(s.occurred_at)}
                    {s.source_url && (
                      <a href={s.source_url} target="_blank" rel="noreferrer" className="ml-1 text-primary hover:underline">
                        source ↗
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </BriefSection>

          <BriefSection title="Company now" freshness={freshness}>
            {brief.company_now}
          </BriefSection>

          <BriefSection title="People" freshness={freshness}>
            {accountContacts.length ? (
              <ul className="space-y-1">
                {accountContacts.map((c) => (
                  <li key={c.id}>
                    <span className="font-medium">{c.full_name}</span>{" "}
                    <span className="text-muted">— {c.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">No contacts on file.</p>
            )}
          </BriefSection>

          <BriefSection title="Talking points" freshness={freshness}>
            <ul className="list-disc space-y-1 pl-4">
              {brief.talking_points.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </BriefSection>

          {brief.landmines.length > 0 && (
            <BriefSection title="Landmines" freshness={freshness}>
              <ul className="list-disc space-y-1 pl-4 text-hot">
                {brief.landmines.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </BriefSection>
          )}

          <BriefSection title="History" freshness={freshness}>
            {brief.history}
          </BriefSection>
        </>
      ) : (
        <p className="text-sm text-muted">Couldn&apos;t generate the brief — retry.</p>
      )}
    </div>
  );
}
