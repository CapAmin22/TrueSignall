"use client";

/**
 * S1 · Onboarding wizard — 5 steps, centered card 640px, Skip on every step,
 * progress % (docs/02 §5, docs/01 F1). Exit-with-signal guarantee (OB-05).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Zap, Mail, Upload, Check, ArrowRight } from "lucide-react";
import Papa from "papaparse";
import { copy } from "@/lib/copy";
import { cn, normalizeDomain } from "@/lib/utils";
import { inferICPAction, type InferredICP } from "@/app/actions/ai";
import { completeOnboardingAction } from "@/app/actions/workspace";
import { Button } from "@/components/ui/button";
import { Card, Chip, Input, Skeleton, Textarea } from "@/components/ui/primitives";

const STEPS = copy.onboarding.steps;

interface ImportRow {
  domain: string;
  name?: string;
  duplicate: boolean;
  invalid: boolean;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [domain, setDomain] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [icp, setICP] = useState<InferredICP | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [pending, startTransition] = useTransition();

  const progress = Math.round(((step - 1) / (STEPS.length - 1)) * 100);

  const infer = () => {
    startTransition(async () => {
      try {
        setICP(await inferICPAction(normalizeDomain(domain || "example.com"), oneLiner || "signal-based GTM tool"));
      } catch {
        setICP(null);
      }
    });
  };

  const parseCSV = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const seen = new Set<string>();
        const parsed: ImportRow[] = result.data.map((r) => {
          const raw = r.domain ?? r.Domain ?? r.website ?? r.Website ?? Object.values(r)[0] ?? "";
          const d = normalizeDomain(raw);
          const invalid = !d.includes(".");
          const duplicate = seen.has(d);
          seen.add(d);
          return { domain: d, name: r.name ?? r.Name, duplicate, invalid };
        });
        setRows(parsed);
      },
    });
  };

  const pasteDomains = (text: string) => {
    const seen = new Set<string>();
    setRows(
      text
        .split(/[\s,;]+/)
        .filter(Boolean)
        .map((raw) => {
          const d = normalizeDomain(raw);
          const duplicate = seen.has(d);
          seen.add(d);
          return { domain: d, duplicate, invalid: !d.includes(".") };
        }),
    );
  };

  const validCount = useMemo(() => rows.filter((r) => !r.invalid && !r.duplicate).length, [rows]);

  const next = () => {
    if (step < 5) {
      setStep(step + 1);
      return;
    }
    // Persist workspace + ICP + imports when Supabase is configured
    // (no-op in demo mode), then enter the feed.
    startTransition(async () => {
      try {
        await completeOnboardingAction({
          domain: normalizeDomain(domain || "example.com"),
          oneLiner: oneLiner || "signal-based GTM tool",
          icp: (icp ?? {}) as unknown as Record<string, unknown>,
          importDomains: rows.filter((r) => !r.invalid && !r.duplicate).map((r) => r.domain),
        });
      } catch {
        // demo mode or transient failure — the feed still renders
      }
      router.push("/feed");
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-[640px]">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-primary text-white">
            <Zap size={15} />
          </span>
          <span className="text-sm font-semibold text-text">{copy.appName}</span>
          <span className="ml-auto text-xs tabular-nums text-muted">{progress}%</span>
        </div>

        <div className="mb-6 flex items-center gap-1">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 flex-col gap-1">
              <div
                className={cn(
                  "h-1 rounded-full",
                  i + 1 <= step ? "bg-primary" : "bg-border",
                )}
              />
              <span className={cn("text-[10px]", i + 1 === step ? "font-medium text-primary" : "text-muted")}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <Card className="p-6">
          {step === 1 && (
            <div className="text-center">
              <h1 className="text-lg font-semibold text-text">Welcome to Signal AI</h1>
              <p className="mt-1 text-sm text-muted">
                Setup takes under 30 minutes — most founders finish in 12.
              </p>
              <div className="mx-auto mt-5 flex max-w-xs flex-col gap-2">
                <Button variant="primary" size="lg" className="justify-center" onClick={next}>
                  Continue with Google
                </Button>
                <Button size="lg" className="justify-center" onClick={next}>
                  Continue with LinkedIn
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted">
                Demo mode — OAuth wiring activates when Supabase keys are configured.
              </p>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="text-lg font-semibold text-text">What do you sell?</h1>
              <p className="mt-1 text-sm text-muted">
                Your URL gives us context. The one-liner drives ICP inference.
              </p>
              <label className="mb-1 mt-4 block text-xs font-medium text-muted">Company URL</label>
              <Input
                placeholder="yourcompany.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
              <label className="mb-1 mt-3 block text-xs font-medium text-muted">
                One-liner ({200 - oneLiner.length} left)
              </label>
              <Textarea
                rows={2}
                maxLength={200}
                placeholder="We help B2B founders reach buyers at the exact right moment…"
                value={oneLiner}
                onChange={(e) => setOneLiner(e.target.value)}
              />
              {!icp && !pending && (
                <Button variant="primary" className="mt-4" onClick={infer} disabled={!oneLiner.trim()}>
                  {copy.onboarding.inferCta}
                </Button>
              )}
              {pending && (
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-3/4" />
                  <p className="text-xs text-muted">Inferring your ideal customer profile…</p>
                </div>
              )}
              {icp && !pending && (
                <div className="mt-4 space-y-3">
                  {(
                    [
                      ["Industries", icp.industries],
                      ["Sizes", icp.company_sizes],
                      ["Stages", icp.stages],
                      ["Seniority", icp.seniorities],
                      ["Geos", icp.geos],
                      ["Pain points", icp.pain_points],
                    ] as [string, string[]][]
                  ).map(([label, values]) => (
                    <div key={label}>
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                        {label}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {values.map((v) => (
                          <Chip key={v} active>
                            {v.replace(/_/g, " ")}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <Button variant="primary" onClick={next}>
                      {copy.onboarding.looksRight}
                    </Button>
                    <Button variant="ghost" onClick={infer}>
                      {copy.onboarding.regenerate}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="text-lg font-semibold text-text">Connect Gmail</h1>
              <p className="mt-1 text-sm text-muted">{copy.onboarding.gmailNudge}.</p>
              <Card className="mt-4 flex items-center gap-3 bg-background">
                <Mail size={20} className="text-muted" />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-text">Gmail — metadata only</p>
                  <p className="text-xs text-muted">
                    Headers only for the relationship graph. Bodies are never stored.
                  </p>
                </div>
                <Button variant="primary" size="sm" onClick={next}>
                  Connect
                </Button>
              </Card>
            </div>
          )}

          {step === 4 && (
            <div>
              <h1 className="text-lg font-semibold text-text">Import your targets</h1>
              <p className="mt-1 text-sm text-muted">
                CSV, HubSpot, Notion, or paste domains — duplicates are flagged automatically.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[10px] border border-dashed border-border p-5 text-center hover:border-primary/50">
                  <Upload size={20} className="text-muted" />
                  <span className="text-sm font-medium text-text">Drop a CSV</span>
                  <span className="text-xs text-muted">column mapping runs automatically</span>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && parseCSV(e.target.files[0])}
                  />
                </label>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted">…or paste domains</p>
                  <Textarea
                    rows={4}
                    placeholder={"acme.io\nlumenly.com\nbasaltlabs.com"}
                    onChange={(e) => pasteDomains(e.target.value)}
                  />
                </div>
              </div>
              {rows.length > 0 && (
                <div className="mt-4 rounded-[8px] border border-border bg-background p-3 text-xs">
                  <p className="font-medium text-text">
                    {validCount} ready to monitor
                    {rows.some((r) => r.duplicate) &&
                      ` · ${rows.filter((r) => r.duplicate).length} duplicates flagged`}
                    {rows.some((r) => r.invalid) &&
                      ` · ${rows.filter((r) => r.invalid).length} invalid`}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {rows.slice(0, 12).map((r, i) => (
                      <span
                        key={i}
                        className={cn(
                          "rounded-full px-2 py-0.5",
                          r.invalid
                            ? "bg-hot/10 text-hot line-through"
                            : r.duplicate
                              ? "bg-warn/10 text-warn"
                              : "bg-signal/10 text-signal",
                        )}
                      >
                        {r.domain}
                      </span>
                    ))}
                    {rows.length > 12 && <span className="text-muted">+{rows.length - 12} more</span>}
                  </div>
                </div>
              )}
              <Button variant="primary" className="mt-4" onClick={next}>
                {rows.length ? `Monitor ${validCount} accounts` : "Continue"}
                <ArrowRight size={14} />
              </Button>
            </div>
          )}

          {step === 5 && (
            <div className="text-center">
              <h1 className="text-lg font-semibold text-text">{copy.onboarding.firstSignals(6)}</h1>
              <p className="mt-1 text-sm text-muted">
                We backfilled the last 30 days on your accounts and ran a live sweep — your feed is
                already prioritized.
              </p>
              <div className="mx-auto mt-4 max-w-sm space-y-2 text-left">
                {[
                  "Acme Corp raised $12M Series A",
                  "Sarah Kim joined Lumenly as CTO",
                  "Basalt Labs hiring 3 SDRs in London",
                ].map((t) => (
                  <div key={t} className="flex items-center gap-2 rounded-[8px] border border-border bg-background p-2.5 text-sm text-text">
                    <Check size={14} className="shrink-0 text-signal" />
                    {t}
                  </div>
                ))}
              </div>
              <Link href="/feed">
                <Button variant="primary" size="lg" className="mt-5">
                  {copy.onboarding.enter}
                  <ArrowRight size={15} />
                </Button>
              </Link>
            </div>
          )}
        </Card>

        {step < 5 && (
          <div className="mt-3 text-center">
            <button className="text-xs text-muted hover:text-text" onClick={next}>
              {copy.onboarding.skip} this step
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
