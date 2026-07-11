/**
 * Channel recommendation engine — deterministic, no AI.
 * Guides founders to the best outreach channel based on:
 *   1. Where the signal was captured (reply where they're active)
 *   2. Warmth band (hot = personal channels, cold = professional channels)
 *   3. Moment type (birthday = text, job change = LinkedIn DM)
 *
 * Trust logic: if the signal came from LinkedIn, the founder should reply
 * on LinkedIn — that's where the conversation context lives. If the
 * relationship is hot, prefer personal channels (text, call). If cold,
 * stay professional (email, LinkedIn DM).
 */

import type { SignalType } from "@/lib/signals/taxonomy";
import type { PersonalSignalType, WarmthBand } from "@/lib/relationships/types";

export type OutreachChannel = "email" | "linkedin_dm" | "text" | "twitter_dm" | "call";

export interface ChannelRecommendation {
  channel: OutreachChannel;
  confidence: "high" | "medium" | "low";
  reason: string;
  /** Short label for UI chips. */
  label: string;
}

const CHANNEL_LABELS: Record<OutreachChannel, string> = {
  email: "Email",
  linkedin_dm: "LinkedIn DM",
  text: "Text message",
  twitter_dm: "X / Twitter DM",
  call: "Phone call",
};

/* ── Source → default channel map ──────────────────────────────────── */

const SOURCE_CHANNEL: Record<string, OutreachChannel> = {
  // LinkedIn-sourced signals → reply on LinkedIn
  clipper: "linkedin_dm",
  linkedin_clip: "linkedin_dm",
  linkedin_scrape: "linkedin_dm",

  // Twitter/X sources
  twitter_search: "twitter_dm",
  x_search: "twitter_dm",

  // Job boards → email (professional context)
  greenhouse_boards: "email",
  lever_postings: "email",
  ashby_boards: "email",
  workable_widget: "email",
  careers_diff: "email",

  // News/press/RSS → email (contextual outreach)
  techcrunch_rss: "email",
  finsmes_rss: "email",
  eu_startups_rss: "email",
  prnewswire_rss: "email",
  businesswire_rss: "email",
  google_news_account: "email",
  champion_news: "email",

  // Product launch → email (thoughtful response)
  producthunt_gql: "email",
  github_events: "email",

  // Website pixel → email (they came to you)
  pixel: "email",
  rb2b: "email",

  // Tech detect → email
  tech_detect: "email",

  // Personal sources
  birthday_calendar: "text",
  news: "email",
  manual: "email",
};

/** Signal type → warmth-adjusted default channel. */
const SIGNAL_TYPE_CHANNEL: Partial<Record<SignalType, OutreachChannel>> = {
  linkedin_clip: "linkedin_dm",
  champion_move: "linkedin_dm",
  pricing_visit: "email",
  site_visit: "email",
  funding: "email",
  hiring: "email",
  exec_change: "linkedin_dm",
};

/** Personal moment type → default channel. */
const MOMENT_CHANNEL: Record<PersonalSignalType, OutreachChannel> = {
  birthday: "text",
  new_baby: "text",
  new_home: "text",
  wedding: "text",
  job_change: "linkedin_dm",
  promotion: "linkedin_dm",
  work_anniversary: "linkedin_dm",
  award: "linkedin_dm",
  speaking: "email",
  published: "linkedin_dm",
  company_milestone: "linkedin_dm",
  education: "linkedin_dm",
};

/* ── Warmth overrides ──────────────────────────────────────────────── */

function warmthOverride(base: OutreachChannel, band: WarmthBand): OutreachChannel {
  // Hot relationships → personal channels upgrade
  if (band === "hot") {
    if (base === "email" || base === "linkedin_dm") return "text";
  }
  // Cold relationships → professional channels downgrade
  if (band === "cold") {
    if (base === "text" || base === "call") return "email";
    if (base === "twitter_dm") return "email";
  }
  return base;
}

/* ── Reason generation ─────────────────────────────────────────────── */

function sourceReason(source: string, channel: OutreachChannel): string {
  const platform = sourceToPlatform(source);
  if (channel === "linkedin_dm" && platform.includes("LinkedIn")) {
    return "Signal captured on LinkedIn — reply where they're already active.";
  }
  if (channel === "twitter_dm") {
    return "Signal captured on X/Twitter — engage where they posted.";
  }
  if (channel === "text") {
    return "Close relationship — a personal text carries the most warmth.";
  }
  if (channel === "email") {
    return "Professional context — a thoughtful email gives them space to respond.";
  }
  if (channel === "call") {
    return "Strong relationship — a quick call shows you care.";
  }
  return `Best channel based on where this signal was captured.`;
}

function warmthReason(band: WarmthBand, channel: OutreachChannel): string {
  if (band === "hot" && channel === "text") {
    return "Hot relationship — personal text keeps the warmth alive.";
  }
  if (band === "hot" && channel === "call") {
    return "Hot relationship — a call shows genuine care.";
  }
  if (band === "cold" && channel === "email") {
    return "Cooling relationship — re-establish with a thoughtful email first.";
  }
  return "";
}

/* ── Public API ─────────────────────────────────────────────────────── */

/** Recommend the best outreach channel for a company signal. */
export function recommendSignalChannel(
  signalType: SignalType,
  source: string,
  band?: WarmthBand,
): ChannelRecommendation {
  // Priority: source-specific → signal-type → default email
  const base =
    SOURCE_CHANNEL[source] ??
    SIGNAL_TYPE_CHANNEL[signalType] ??
    "email";

  const channel = band ? warmthOverride(base, band) : base;
  const reason =
    (band ? warmthReason(band, channel) : "") || sourceReason(source, channel);

  return {
    channel,
    confidence: SOURCE_CHANNEL[source] ? "high" : "medium",
    reason,
    label: CHANNEL_LABELS[channel],
  };
}

/** Recommend the best outreach channel for a personal moment. */
export function recommendMomentChannel(
  momentType: PersonalSignalType,
  source: string,
  band: WarmthBand,
): ChannelRecommendation {
  const base = MOMENT_CHANNEL[momentType];
  const channel = warmthOverride(base, band);
  const reason =
    warmthReason(band, channel) ||
    momentReason(momentType, channel);

  return {
    channel,
    confidence: "high",
    reason,
    label: CHANNEL_LABELS[channel],
  };
}

function momentReason(type: PersonalSignalType, channel: OutreachChannel): string {
  const personal = ["birthday", "new_baby", "new_home", "wedding"];
  if (personal.includes(type) && channel === "text") {
    return "Life moments deserve a personal touch — text feels genuine, not transactional.";
  }
  if (channel === "linkedin_dm") {
    return "Professional milestone — LinkedIn is where they shared it and where congratulations feel natural.";
  }
  return "Reach out where the conversation feels most natural.";
}

/* ── Helpers ────────────────────────────────────────────────────────── */

/** Map a raw source key to a human-readable platform name. */
export function sourceToPlatform(source: string): string {
  const MAP: Record<string, string> = {
    clipper: "LinkedIn (Clipped)",
    linkedin_clip: "LinkedIn",
    techcrunch_rss: "TechCrunch",
    finsmes_rss: "Finsmes",
    eu_startups_rss: "EU-Startups",
    prnewswire_rss: "PR Newswire",
    businesswire_rss: "BusinessWire",
    google_news_account: "Google News",
    greenhouse_boards: "Greenhouse",
    lever_postings: "Lever",
    ashby_boards: "Ashby",
    workable_widget: "Workable",
    careers_diff: "Careers page",
    tech_detect: "Tech detection",
    producthunt_gql: "Product Hunt",
    github_events: "GitHub",
    champion_news: "News monitoring",
    pixel: "Your website",
    rb2b: "RB2B (Visitor ID)",
    twitter_search: "X / Twitter",
    x_search: "X / Twitter",
    birthday_calendar: "Your contacts",
    news: "News",
    manual: "Manual entry",
    edgar_form_d: "SEC EDGAR",
  };
  return MAP[source] ?? source.replace(/_/g, " ");
}

/** True if this source represents a social platform where DM is possible. */
export function isReplyableSource(source: string): boolean {
  return ["clipper", "linkedin_clip", "twitter_search", "x_search"].includes(source);
}
