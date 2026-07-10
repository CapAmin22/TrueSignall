"use client";

/**
 * S11 · Network — the founder's personal graph, kept warm on purpose.
 * Import contacts (CSV / LinkedIn export; Gmail & phone sync activate with
 * OAuth) → warmth-scored relationship table → reconnect queue → warm-intro
 * paths into the hottest monitored accounts.
 */
import { useMemo, useRef, useState } from "react";
import { Upload, Users, Route, Flame, HandHeart, MessageSquare } from "lucide-react";
import Papa from "papaparse";
import { useDemoStore } from "@/lib/demo/store";
import { copy } from "@/lib/copy";
import { cn, normalizeDomain, relativeTime } from "@/lib/utils";
import { computeWarmth, reconnectQueue, CADENCE_DAYS } from "@/lib/relationships/warmth";
import { pathsIntoAccounts, isDecisionMaker } from "@/lib/relationships/intro-paths";
import type { Connection, WarmthBand } from "@/lib/relationships/types";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/primitives";

const BAND_TONE: Record<WarmthBand, "hot" | "signal" | "warn" | "muted"> = {
  hot: "hot",
  warm: "signal",
  cooling: "warn",
  cold: "muted",
};

const SOURCE_LABEL: Record<Connection["source"], string> = {
  gmail_import: "Gmail",
  phone_import: "Phone",
  linkedin_export: "LinkedIn",
  csv_import: "CSV",
  manual: "Manual",
};

/** Map a CSV row (LinkedIn export or generic contacts CSV) → Connection. */
function rowToConnection(r: Record<string, string>): Connection | null {
  const name =
    r.name ?? r.Name ?? [r["First Name"] ?? "", r["Last Name"] ?? ""].join(" ").trim();
  if (!name?.trim()) return null;
  const email = r.email ?? r.Email ?? r["Email Address"] ?? "";
  const company = r.company ?? r.Company ?? "";
  const emailDomain = email.includes("@") ? email.split("@")[1] : "";
  const freeMail = /gmail|outlook|yahoo|hotmail|icloud/.test(emailDomain);
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `n-${Date.now()}-${Math.random()}`,
    full_name: name.trim(),
    emails: email ? [email.trim().toLowerCase()] : [],
    phones: r.phone ?? r.Phone ? [String(r.phone ?? r.Phone)] : [],
    company_domain: company ? normalizeDomain(company) : freeMail || !emailDomain ? null : emailDomain.toLowerCase(),
    company_name: company || null,
    title: r.title ?? r.Title ?? r.Position ?? r.position ?? null,
    linkedin_url: r.linkedin_url ?? r.URL ?? null,
    source: r["Connected On"] ? "linkedin_export" : "csv_import",
    closeness: 40,
    last_interaction_at: null,
    interaction_count: 0,
    birthday: r.birthday ?? r.Birthday ?? null,
    tags: [],
    notes: "",
    created_at: new Date().toISOString(),
  };
}

export default function NetworkPage() {
  const store = useDemoStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [imported, setImported] = useState<number | null>(null);
  const [bandFilter, setBandFilter] = useState<WarmthBand | null>(null);

  const scored = useMemo(
    () =>
      store.connections
        .map((connection) => ({ connection, warmth: computeWarmth(connection) }))
        .sort((a, b) => b.warmth.score - a.warmth.score),
    [store.connections],
  );

  const due = useMemo(() => reconnectQueue(store.connections).slice(0, 6), [store.connections]);

  const paths = useMemo(() => {
    const targets = store.accounts
      .filter((a) => a.status !== "archived")
      .sort((a, b) => b.urgency_score - a.urgency_score)
      .slice(0, 8)
      .flatMap((a) => {
        const company = store.companies.find((c) => c.id === a.company_id);
        return company
          ? [{ accountId: a.id, domain: company.domain, label: `${company.name} · urgency ${a.urgency_score}` }]
          : [];
      });
    return pathsIntoAccounts(targets, store.connections).slice(0, 5);
  }, [store.accounts, store.companies, store.connections]);

  const stats = useMemo(() => {
    const dms = store.connections.filter(isDecisionMaker).length;
    const warmPlus = scored.filter(({ warmth }) => warmth.band === "hot" || warmth.band === "warm").length;
    return { total: store.connections.length, dms, warmPlus, due: reconnectQueue(store.connections).length };
  }, [store.connections, scored]);

  const importFile = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data.map(rowToConnection).filter((c): c is Connection => c !== null);
        setImported(store.addConnections(rows));
      },
    });
  };

  const visible = bandFilter ? scored.filter(({ warmth }) => warmth.band === bandFilter) : scored;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-text">{copy.network.title}</h1>
        <div className="ml-auto flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
          />
          <Button variant="primary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload size={13} />
            {copy.network.import}
          </Button>
        </div>
      </div>
      <p className="mb-2 text-sm text-muted">{copy.network.sub}</p>
      <p className="mb-5 text-xs text-muted">
        CSV and LinkedIn connection exports import now · Gmail and phone contact sync activate
        automatically once Google OAuth is connected. Your network stays private to this
        workspace — never shared, never used to enrich anyone else&apos;s data.
        {imported !== null && (
          <span className="ml-2 font-medium text-signal">{imported} imported</span>
        )}
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { icon: Users, label: "Connections", value: stats.total },
          { icon: Flame, label: "Decision makers", value: stats.dms },
          { icon: HandHeart, label: "Hot + warm", value: stats.warmPlus },
          { icon: MessageSquare, label: "Due a touch", value: stats.due },
        ].map(({ icon: Icon, label, value }) => (
          <Card key={label} className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
              <Icon size={15} />
            </span>
            <div>
              <p className="text-lg font-semibold tabular-nums text-text">{value}</p>
              <p className="text-xs text-muted">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {paths.length > 0 && (
        <>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text">
            <Route size={14} className="text-primary" />
            {copy.network.pathsTitle}
          </h2>
          <div className="mb-6 grid gap-3 md:grid-cols-2">
            {paths.map(({ accountId, label, paths: intro }) => (
              <Card key={accountId}>
                <p className="text-sm font-medium text-text">{label}</p>
                {intro.slice(0, 2).map((p) => (
                  <p key={p.connection.id} className="mt-1.5 text-xs text-muted">
                    <span className="font-medium text-text">{p.connection.full_name}</span> — {p.reason}
                    <Badge tone={p.strength >= 60 ? "signal" : "muted"} className="ml-1.5">
                      path {p.strength}
                    </Badge>
                  </p>
                ))}
              </Card>
            ))}
          </div>
        </>
      )}

      {due.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-text">{copy.network.reconnectTitle}</h2>
          <div className="mb-6 flex flex-wrap gap-2">
            {due.map(({ connection, warmth }) => (
              <button
                key={connection.id}
                className="flex items-center gap-2 rounded-[10px] border border-border bg-surface px-3 py-2 text-left text-xs hover:border-primary/40"
                onClick={() => store.logTouch(connection.id)}
                title="Log a touch"
              >
                <span className="font-medium text-text">{connection.full_name}</span>
                <span className="text-muted">
                  {warmth.reconnectDueInDays === 0
                    ? "due today"
                    : `${Math.abs(warmth.reconnectDueInDays)}d overdue`}
                  {" · "}every {CADENCE_DAYS[warmth.band]}d
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mb-3 flex items-center gap-1.5">
        {(["hot", "warm", "cooling", "cold"] as WarmthBand[]).map((band) => (
          <button
            key={band}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs capitalize",
              bandFilter === band ? "bg-primary/10 font-medium text-primary" : "text-muted hover:text-text",
            )}
            onClick={() => setBandFilter(bandFilter === band ? null : band)}
          >
            {band}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Users} title={copy.network.empty} body="Upload a CSV or your LinkedIn connections export to get warmth tracking, moments, and intro paths." />
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">Person</th>
                <th className="px-4 py-2.5 font-medium">Warmth</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Last touch</th>
                <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Source</th>
                <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Tags</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {visible.map(({ connection, warmth }) => (
                <tr key={connection.id} className="border-b border-border/60 last:border-0 hover:bg-background/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text">{connection.full_name}</p>
                    <p className="text-xs text-muted">
                      {connection.title ?? "—"}
                      {connection.company_name ? ` · ${connection.company_name}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={BAND_TONE[warmth.band]} className="capitalize">
                      {warmth.band} · {warmth.score}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted md:table-cell">
                    {connection.last_interaction_at
                      ? relativeTime(connection.last_interaction_at)
                      : "never"}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted lg:table-cell">
                    {SOURCE_LABEL[connection.source]}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {connection.tags.map((t) => (
                        <Badge key={t} tone="muted" className="capitalize">
                          {t.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => store.logTouch(connection.id)}>
                      Log touch
                    </Button>
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
