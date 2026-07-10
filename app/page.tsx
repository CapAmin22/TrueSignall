/**
 * Marketing landing — docs/02 §7. Same tokens; hero + demo feed +
 * problem stats + 3-step how-it-works + flat pricing + FAQ + footer.
 */
import Link from "next/link";
import { Zap, Banknote, Briefcase, MousePointerClick, ArrowRight } from "lucide-react";
import { copy } from "@/lib/copy";
import { PLANS } from "@/lib/plans";
import { Button } from "@/components/ui/button";

const DEMO_CARDS = [
  {
    icon: Banknote,
    tint: "text-signal bg-signal/10",
    company: "Acme Corp",
    title: "Raised $12M Series A led by Foundry",
    why: "Funded companies typically finalize vendors within 90 days.",
    urgency: 84,
  },
  {
    icon: MousePointerClick,
    tint: "text-info bg-info/10",
    company: "Fathom Metrics",
    title: "VP Growth viewed your pricing 3× this week",
    why: "Pricing-page visits signal late-stage evaluation.",
    urgency: 76,
  },
  {
    icon: Briefcase,
    tint: "text-warn bg-warn/10",
    company: "Basalt Labs",
    title: "Hiring 3 SDRs in London",
    why: "An SDR ramp means the outbound stack is being picked now.",
    urgency: 58,
  },
];

const FAQ = [
  {
    q: "Where do the signals come from?",
    a: "15+ public sources: funding feeds and SEC filings, job boards (Greenhouse, Lever, Ashby, Workable), press and news monitoring, Product Hunt, GitHub, your own website pixel, and user-initiated captures. Every signal carries its source URL and timestamp.",
  },
  {
    q: "What Gmail permissions do you need?",
    a: "Send (only when you click Send) and metadata (headers only, for reply detection and your relationship graph). Email bodies are never stored — voice calibration processes them transiently and keeps only a style profile you approve.",
  },
  {
    q: "Do you scrape LinkedIn?",
    a: "No — never. The Signal Clipper lets you capture a public post you're already viewing; we never issue requests to LinkedIn.",
  },
  {
    q: "What happens when I hit a plan limit?",
    a: "The specific capacity pauses gracefully and monitoring of existing accounts continues. No credits, no overage charges — ever.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-text">
      <header className="mx-auto flex max-w-5xl items-center gap-2 px-6 py-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-primary text-white">
          <Zap size={15} />
        </span>
        <span className="text-sm font-semibold">{copy.appName}</span>
        <nav className="ml-auto flex items-center gap-4 text-sm text-muted">
          <a href="#pricing" className="hover:text-text">Pricing</a>
          <a href="#faq" className="hover:text-text">FAQ</a>
          <Link href="/login" className="hover:text-text">Sign in</Link>
          <Link href="/onboarding">
            <Button variant="primary" size="sm">{copy.ctaPrimary}</Button>
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-5xl items-center gap-10 px-6 py-16 md:grid-cols-2">
        <div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">{copy.tagline}</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted">{copy.sub}</p>
          <div className="mt-6 flex items-center gap-3">
            <Link href="/onboarding">
              <Button variant="primary" size="lg">
                {copy.ctaPrimary}
                <ArrowRight size={15} />
              </Button>
            </Link>
            <Link href="/feed">
              <Button size="lg">View live demo</Button>
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted">Setup in under 30 minutes · 14-day trial · no card</p>
        </div>
        <div className="space-y-3">
          {DEMO_CARDS.map((c, i) => (
            <div
              key={c.company}
              className="feed-insert rounded-[10px] border border-border bg-surface p-4 shadow-sm"
              style={{ animationDelay: `${i * 250}ms` }}
            >
              <div className="flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full ${c.tint}`}>
                  <c.icon size={14} />
                </span>
                <span className="text-sm font-semibold">{c.company}</span>
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                    c.urgency >= 70 ? "bg-hot/10 text-hot" : "bg-warn/10 text-warn"
                  }`}
                >
                  {c.urgency}
                  {c.urgency >= 70 ? " Hot" : ""}
                </span>
              </div>
              <p className="mt-1.5 text-sm font-medium">{c.title}</p>
              <p className="mt-0.5 text-xs text-muted">Why now: {c.why}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-5xl gap-6 px-6 py-10 text-center md:grid-cols-3">
          <div>
            <p className="text-3xl font-semibold text-signal">15%+</p>
            <p className="mt-1 text-sm text-muted">reply rate on signal-triggered sends vs 3.4% cold baseline</p>
          </div>
          <div>
            <p className="text-3xl font-semibold text-primary">5×</p>
            <p className="mt-1 text-sm text-muted">more likely to win when you&apos;re the first responder</p>
          </div>
          <div>
            <p className="text-3xl font-semibold text-warn">&lt;5 min</p>
            <p className="mt-1 text-sm text-muted">from detected signal to sent, voice-matched outreach</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold">How it works</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            {
              n: "1",
              t: "Point it at your market",
              d: "Paste your URL and a one-liner. AI infers your ICP; import your target list in one click.",
            },
            {
              n: "2",
              t: "Watch signals roll in",
              d: "Funding, hiring, exec moves, tech changes, pricing-page visits — deduped, scored 0–100, stacked when they converge.",
            },
            {
              n: "3",
              t: "Send at the right moment",
              d: "One click drafts a voice-matched email referencing the signal. Send from your own Gmail; replies tracked automatically.",
            },
          ].map((s) => (
            <div key={s.n} className="rounded-[10px] border border-border bg-surface p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {s.n}
              </span>
              <h3 className="mt-3 text-sm font-semibold">{s.t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The USP — relationship layer */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-primary">
            Why founders keep it
          </p>
          <h2 className="mt-2 text-center text-2xl font-semibold">
            Network is built first. Everything is sold on trust.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-muted">
            Your real sales asset is the network you already have — colleagues, batchmates,
            investors, conference friends. TrueSignall imports it, keeps it deliberately warm,
            and turns it into doors that open before the pitch.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              {
                t: "Moments, not just signals",
                d: "Birthdays, new babies, new homes, promotions — personal reasons to reach out with zero pitch. The AI note generator is hard-ruled to never sell.",
              },
              {
                t: "Warmth that doesn't fade silently",
                d: "Every relationship is scored hot → cold on a 45-day decay. The reconnect queue tells you who's due a touch before the trust expires.",
              },
              {
                t: "Warm paths into hot accounts",
                d: "The moment an account lights up, the pathfinder shows who in your own network already works there — ranked by warmth × seniority.",
              },
            ].map((s) => (
              <div key={s.t} className="rounded-[10px] border border-border bg-surface p-5">
                <h3 className="text-sm font-semibold">{s.t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted">
            Your contacts stay private to your workspace — never shared, never used to enrich
            anyone else&apos;s data.
          </p>
        </div>
      </section>

      <section id="pricing" className="border-t border-border bg-surface">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center text-2xl font-semibold">Flat pricing. {copy.billing.noCredits}</h2>
          <p className="mt-2 text-center text-sm text-muted">
            No credits, no usage billing, no surprise charges. Annual = 2 months free.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {(["starter", "growth", "scale"] as const).map((key) => {
              const p = PLANS[key];
              return (
                <div
                  key={key}
                  className={`rounded-[10px] border bg-background p-6 ${
                    p.anchor ? "border-primary ring-1 ring-primary/30" : "border-border"
                  }`}
                >
                  {p.anchor && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Most popular
                    </span>
                  )}
                  <h3 className="mt-2 text-sm font-semibold">{p.name}</h3>
                  <p className="mt-1 text-3xl font-semibold">
                    ${p.priceMonthly}
                    <span className="text-sm font-normal text-muted">/mo</span>
                  </p>
                  <ul className="mt-4 space-y-2 text-sm text-muted">
                    <li>{p.accounts} accounts monitored</li>
                    <li>{p.contacts.toLocaleString()} contacts</li>
                    <li>
                      {p.seats} seat{p.seats > 1 ? "s" : ""}
                    </li>
                    <li>{p.draftsPerMonth.toLocaleString()} AI drafts / month</li>
                    <li className="text-text">{p.note}</li>
                  </ul>
                  <Link href="/onboarding" className="mt-5 block">
                    <Button variant={p.anchor ? "primary" : "secondary"} className="w-full justify-center">
                      Start 14-day trial
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold">Questions founders ask</h2>
        <div className="mt-8 space-y-4">
          {FAQ.map((f) => (
            <details key={f.q} className="rounded-[10px] border border-border bg-surface p-4">
              <summary className="cursor-pointer text-sm font-medium">{f.q}</summary>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-6 py-8 text-xs text-muted">
          <span>© 2026 {copy.appName} (TrueSignall)</span>
          <nav className="ml-auto flex gap-4">
            <a href="#" className="hover:text-text">Privacy</a>
            <a href="#" className="hover:text-text">Terms</a>
            <a href="#" className="hover:text-text">DPA</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
