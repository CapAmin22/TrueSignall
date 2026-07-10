"use client";

/**
 * S10 · Settings — profile · icp · team · notifications · integrations ·
 * competitors · billing (docs/02 §5).
 */
import Link from "next/link";
import { use, useState } from "react";
import { Mail, Copy, Check, ExternalLink } from "lucide-react";
import { useDemoStore, sources } from "@/lib/demo/store";
import { cn } from "@/lib/utils";
import { copy as productCopy } from "@/lib/copy";
import { PLANS, meterStatus } from "@/lib/plans";
import { SIGNAL_TYPES } from "@/lib/signals/taxonomy";
import { signalTypeLabel } from "@/components/signal/SignalTypeIcon";
import { SourceHealthDot } from "@/components/shared/SourceHealthDot";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Card, Chip, Input, Meter } from "@/components/ui/primitives";

const SECTIONS = [
  "profile",
  "icp",
  "team",
  "notifications",
  "integrations",
  "competitors",
  "billing",
] as const;

type Section = (typeof SECTIONS)[number];

const NOTIFIABLE_TYPES = SIGNAL_TYPES.filter(
  (t) => !["conference", "intent_surge", "g2_activity"].includes(t),
);

/** PS-07 defaults: funding/champion/pricing_visit=realtime, rest=daily. */
const DEFAULT_MODES: Record<string, string> = Object.fromEntries(
  NOTIFIABLE_TYPES.map((t) => [
    t,
    ["funding", "champion_move", "pricing_visit"].includes(t) ? "realtime" : "daily",
  ]),
);

export default function SettingsPage({ params }: { params: Promise<{ section: string }> }) {
  const { section: raw } = use(params);
  const section = (SECTIONS.includes(raw as Section) ? raw : "profile") as Section;
  const store = useDemoStore();
  const { workspace, members } = store;
  const [modes, setModes] = useState<Record<string, string>>(DEFAULT_MODES);
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  const plan = PLANS[workspace.plan === "trial" ? "trial" : workspace.plan];
  const meters = meterStatus(plan, store.usage);

  const pixelSnippet = `<script async src="https://app.truesignall.com/px.js" data-ws="${store.workspaceId ?? "ws_demo_token"}"></script>`;

  const copySnippet = () => {
    void navigator.clipboard.writeText(pixelSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-text">Settings</h1>
      <div className="mb-6 flex flex-wrap gap-1 border-b border-border">
        {SECTIONS.map((s) => (
          <Link
            key={s}
            href={`/settings/${s}`}
            className={cn(
              "border-b-2 px-3 py-2 text-sm capitalize transition-colors",
              section === s
                ? "border-primary font-medium text-primary"
                : "border-transparent text-muted hover:text-text",
            )}
          >
            {s === "icp" ? "ICP" : s}
          </Link>
        ))}
      </div>

      {section === "profile" && (
        <Card className="max-w-lg">
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={workspace.founder_name} className="h-12 w-12 text-base" />
            <div>
              <p className="text-sm font-semibold text-text">{workspace.founder_name}</p>
              <p className="text-xs text-muted">amin@truesignall.com · Owner</p>
            </div>
          </div>
          <label className="mb-1 block text-xs font-medium text-muted">Workspace name</label>
          <Input defaultValue={workspace.name} className="mb-3" />
          <label className="mb-1 block text-xs font-medium text-muted">Company domain</label>
          <Input defaultValue={workspace.domain} className="mb-3" />
          <label className="mb-1 block text-xs font-medium text-muted">Product one-liner</label>
          <Input defaultValue={workspace.one_liner} className="mb-4" />
          <Button variant="primary" size="sm">Save changes</Button>
        </Card>
      )}

      {section === "icp" && (
        <div className="max-w-2xl space-y-4">
          <p className="text-sm text-muted">
            The same chip editor as onboarding. Owner edits apply workspace-wide; members see
            read-only global fields plus a personal-filter layer (TC-04).
          </p>
          {(
            [
              ["Industries", workspace.icp.industries],
              ["Company sizes", workspace.icp.company_sizes],
              ["Stages", workspace.icp.stages],
              ["Seniorities", workspace.icp.seniorities ?? []],
              ["Geos", workspace.icp.geos],
              ["Pain points", workspace.icp.pain_points ?? []],
            ] as [string, string[]][]
          ).map(([label, values]) => (
            <Card key={label}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
              <div className="flex flex-wrap gap-1.5">
                {values.map((v) => (
                  <Chip key={v} active>
                    {v.replace(/_/g, " ")}
                  </Chip>
                ))}
                <Chip>+ add</Chip>
              </div>
            </Card>
          ))}
          <p className="text-xs text-muted">
            Editing the ICP recomputes fit scores across all monitored accounts.
          </p>
        </div>
      )}

      {section === "team" && (
        <div className="max-w-2xl space-y-4">
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="py-2 font-medium">Member</th>
                  <th className="py-2 font-medium">Role</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-border/60 last:border-0">
                    <td className="flex items-center gap-2 py-2.5">
                      <Avatar name={m.full_name} />
                      <span>
                        <span className="block font-medium text-text">{m.full_name}</span>
                        <span className="block text-xs text-muted">{m.email}</span>
                      </span>
                    </td>
                    <td className="py-2.5 capitalize text-muted">{m.role}</td>
                    <td className="py-2.5 text-right">
                      {m.role !== "owner" && (
                        <Button variant="ghost" size="sm">Remove</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Invite member
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="teammate@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <Button variant="primary" disabled={!inviteEmail.includes("@")}>
                <Mail size={14} />
                Invite
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted">
              Members inherit the workspace ICP read-only and can layer personal filters.
              {" "}Plan seats: {store.usage.seats}/{plan.seats}.
            </p>
          </Card>
        </div>
      )}

      {section === "notifications" && (
        <Card className="max-w-2xl">
          <p className="mb-3 text-sm text-muted">
            Per-signal-type delivery. Real-time also emails you when urgency ≥70.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="py-2 font-medium">Signal type</th>
                <th className="py-2 font-medium">Real-time</th>
                <th className="py-2 font-medium">Daily digest</th>
                <th className="py-2 font-medium">Off</th>
              </tr>
            </thead>
            <tbody>
              {NOTIFIABLE_TYPES.map((t) => (
                <tr key={t} className="border-b border-border/60 last:border-0">
                  <td className="py-2 text-text">{signalTypeLabel(t)}</td>
                  {(["realtime", "daily", "off"] as const).map((mode) => (
                    <td key={mode} className="py-2">
                      <input
                        type="radio"
                        name={`notif-${t}`}
                        checked={modes[t] === mode}
                        onChange={() => setModes((m) => ({ ...m, [t]: mode }))}
                        aria-label={`${signalTypeLabel(t)} ${mode}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {section === "integrations" && (
        <div className="max-w-2xl space-y-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-text">Gmail</p>
                <p className="text-xs text-muted">
                  Send-as-you + reply detection (metadata only — bodies are never stored).
                </p>
              </div>
              <Badge tone="warn">Not connected</Badge>
              <Button variant="primary" size="sm">Connect</Button>
            </div>
            <p className="mt-2 text-xs text-muted">
              Scopes requested just-in-time: gmail.send at first send · gmail.metadata for the
              relationship graph. <span className="text-primary">What we store ↗</span>
            </p>
          </Card>
          <Card>
            <p className="mb-1 text-sm font-semibold text-text">Website pixel</p>
            <p className="mb-2 text-xs text-muted">
              Paste into your site&apos;s &lt;head&gt;. Pricing-page visits become Hot signals ≤15 min.
            </p>
            <div className="flex items-center gap-2 rounded-[8px] border border-border bg-background p-2.5 font-mono text-[11px] text-muted">
              <code className="min-w-0 flex-1 truncate">{pixelSnippet}</code>
              <Button variant="ghost" size="sm" onClick={copySnippet}>
                {copied ? <Check size={13} className="text-signal" /> : <Copy size={13} />}
              </Button>
            </div>
            <Button size="sm" className="mt-2">Verify installation</Button>
          </Card>
          <Card>
            <p className="mb-1 text-sm font-semibold text-text">RB2B webhook</p>
            <p className="mb-2 text-xs text-muted">
              Optional person-level identification for US visitors (free plan supported).
            </p>
            <code className="block truncate rounded-[8px] border border-border bg-background p-2.5 font-mono text-[11px] text-muted">
              https://app.truesignall.com/api/webhooks/rb2b
            </code>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="opacity-70">
              <p className="text-sm font-semibold text-text">HubSpot</p>
              <Badge className="mt-1">v1.1</Badge>
            </Card>
            <Card className="opacity-70">
              <p className="text-sm font-semibold text-text">Outlook</p>
              <Badge className="mt-1">coming soon</Badge>
            </Card>
          </div>
          <Card>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Source health
            </p>
            <div className="grid gap-1.5 md:grid-cols-2">
              {sources.map((s) => (
                <div key={s.key} className="flex items-center gap-2 text-xs">
                  <SourceHealthDot consecutiveFailures={s.consecutive_failures} enabled={s.enabled} />
                  <span className="text-text">{s.key}</span>
                  <span className="ml-auto text-muted">{s.signals_today} today</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {section === "competitors" && (
        <Card className="max-w-lg">
          <p className="text-sm text-muted">
            Manage competitors on the dedicated page — alerts, enrichment, and positioning angles
            live there.
          </p>
          <Link href="/competitors">
            <Button className="mt-3" size="sm">
              Open Competitors
              <ExternalLink size={12} />
            </Button>
          </Link>
        </Card>
      )}

      {section === "billing" && (
        <div className="max-w-3xl space-y-4">
          <div className="rounded-[8px] border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-text">
            {productCopy.billing.trialBanner(workspace.trial_days_left)}
          </div>
          <Card>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Usage</p>
            {meters.map((m) => (
              <div key={m.key} className="mb-3">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="capitalize text-text">{m.key}</span>
                  <span className="tabular-nums text-muted">
                    {m.used} / {m.limit}
                  </span>
                </div>
                <Meter used={m.used} limit={m.limit} />
              </div>
            ))}
            <p className="text-xs text-muted">{productCopy.billing.pausedNote}</p>
          </Card>
          <div className="grid gap-3 md:grid-cols-3">
            {(["starter", "growth", "scale"] as const).map((key) => {
              const p = PLANS[key];
              return (
                <Card key={key} className={cn(p.anchor && "border-primary ring-1 ring-primary/30")}>
                  <div className="flex items-baseline gap-1">
                    <p className="text-sm font-semibold text-text">{p.name}</p>
                    {p.anchor && <Badge tone="primary">Most popular</Badge>}
                  </div>
                  <p className="mt-1 text-2xl font-semibold text-text">
                    ${p.priceMonthly}
                    <span className="text-xs font-normal text-muted">/mo</span>
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-muted">
                    <li>{p.accounts} accounts monitored</li>
                    <li>{p.contacts.toLocaleString()} contacts</li>
                    <li>{p.seats} seat{p.seats > 1 ? "s" : ""}</li>
                    <li>{p.draftsPerMonth.toLocaleString()} AI drafts/mo</li>
                  </ul>
                  <Button variant={p.anchor ? "primary" : "secondary"} size="sm" className="mt-3 w-full justify-center">
                    Choose {p.name}
                  </Button>
                </Card>
              );
            })}
          </div>
          <p className="text-center text-xs font-medium text-text">
            {productCopy.billing.noCredits} Flat plans — no usage billing, no surprise charges.
          </p>
        </div>
      )}
    </div>
  );
}
