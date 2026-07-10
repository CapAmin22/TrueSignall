/**
 * All product strings — docs/02 §6: single source, plain, specific, zero hype.
 * Buttons are verbs. Never blame the user in errors.
 */

export const copy = {
  appName: "Signal AI",
  tagline: "Reach out at the exact right moment. Every time.",
  sub: "Signal AI watches your target accounts across 15+ sources and turns buying signals into voice-matched outreach — in one click.",
  ctaPrimary: "Start free — no card",

  nav: {
    feed: "Signals",
    moments: "Moments",
    network: "Network",
    discover: "Discover",
    accounts: "Accounts",
    pipeline: "Pipeline",
    outreach: "Outreach",
    competitors: "Competitors",
    settings: "Settings",
  },

  moments: {
    title: "Moments",
    sub: "Personal reasons to reach out — congratulate first, sell never.",
    empty: "No new moments — import more of your network to catch more of them.",
    writeNote: "Write a note",
    markSent: "Mark sent",
    dismiss: "Dismiss",
  },

  network: {
    title: "Network",
    sub: "Your relationships, kept warm on purpose.",
    import: "Import contacts",
    reconnectTitle: "Due a touch",
    pathsTitle: "Warm paths into your hottest accounts",
    empty: "Import your contacts to start relationship monitoring.",
  },

  feed: {
    title: "Signals",
    empty: "No signals yet — monitoring is live on your accounts",
    emptyCta: "Add accounts",
    newPill: (n: number) => `${n} new signal${n === 1 ? "" : "s"} ↑`,
    draft: "Draft outreach",
    claim: "Claim",
    done: "Done",
    snooze: "Snooze",
    unclaimed: "Unclaimed",
    hot: "Hot",
    inPipeline: "In-Pipeline",
    revisit: "Revisit",
    occurred: "occurred",
    detected: "detected",
  },

  discover: {
    placeholder: 'Try: "B2B fintech, Series A, 20–100 people, US"',
    monitor: "+ Monitor",
    suggestedTitle: "Suggested this week",
    nicheEmpty: "Corpus growing — import your list for instant coverage",
  },

  composer: {
    title: "Draft outreach",
    send: "Send via Gmail",
    connectGmail: "Connect Gmail",
    copyLinkedIn: "Copy for LinkedIn",
    regenerate: "Regenerate",
    followupLabel: "Schedule follow-up if no reply",
    qualityLow: "Draft quality is low — review before sending",
    noTrigger: "Doesn't mention the trigger — edit before sending",
  },

  brief: {
    whyTitle: "Why this conversation",
    coldNotice: "Cold outreach — no signal detected.",
    refresh: "Refresh",
  },

  billing: {
    noCredits: "No credits. Ever.",
    trialBanner: (days: number) =>
      `Trial ends in ${days} day${days === 1 ? "" : "s"} — pick a plan to keep your signals flowing.`,
    limitBanner: (meter: string) =>
      `You're at 80% of your ${meter} limit. Upgrade before it pauses.`,
    pausedNote: "Monitoring of existing accounts never pauses.",
  },

  errors: {
    aiBusy: "AI is busy — retry in 60s.",
    retry: "Retry",
    generic: "Something went wrong on our side. It's been reported.",
  },

  toasts: {
    sent: (name: string, company: string) => `Sent to ${name} at ${company} ✓`,
    viewThread: "View thread",
    claimed: "Claimed — it's yours for 7 days",
    done: "Archived",
    snoozed: (until: string) => `Snoozed until ${until}`,
  },

  onboarding: {
    steps: ["Sign in", "Your product", "Connect Gmail", "Import targets", "Your feed"],
    inferCta: "Infer my ICP",
    looksRight: "Looks right →",
    regenerate: "Regenerate",
    gmailNudge: "Voice-matched drafts need this",
    skip: "Skip",
    enter: "Enter Signal AI",
    firstSignals: (n: number) => `🎉 ${n} signals found on your accounts`,
  },
} as const;

/** Banned phrases — docs/01 §4-F7 + docs/06 P-5 rule 4. Scanned on every draft. */
export const BANNED_PHRASES = [
  "pick your brain",
  "grab a coffee",
  "i hope this finds you well",
  "quick question",
  "circle back",
  "touch base",
  "just checking in",
  "reaching out",
  "i wanted to",
  "hope you're well",
  "exciting",
  "congrats!!",
] as const;

export function scanBannedPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.filter((p) => lower.includes(p));
}
