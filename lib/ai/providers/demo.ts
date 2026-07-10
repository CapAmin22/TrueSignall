/**
 * Demo provider — deterministic, offline answers used ONLY when no LLM keys
 * are configured (prototype mode). Real deployments set GEMINI_API_KEY /
 * GROQ_API_KEY and this module is never reached (docs/06 §1 chain order).
 * Outputs honor the same contracts and hard rules as the real prompts.
 */

function extract(prompt: string, pattern: RegExp): string {
  return prompt.match(pattern)?.[1]?.trim() ?? "";
}

function demoICP(prompt: string): string {
  const oneLiner = extract(prompt, /one-liner:\s*"([^"]*)"/);
  const industries = /fintech|payment|bank/i.test(oneLiner)
    ? ["fintech", "b2b saas"]
    : /dev|api|infra/i.test(oneLiner)
      ? ["developer tools", "b2b saas"]
      : ["b2b saas", "sales tech"];
  return JSON.stringify({
    industries,
    company_sizes: ["11-50", "51-200"],
    stages: ["seed", "series_a"],
    seniorities: ["c_suite", "vp"],
    geos: ["US", "EU"],
    pain_points: [
      "missed buying signals on target accounts",
      "hours lost to manual account research",
      "cold outreach ignored by buyers",
      "no visibility into champion job moves",
    ],
    buyer_titles: ["Founder & CEO", "VP Sales", "Head of Growth"],
    confidence: "medium",
  });
}

function demoFilters(prompt: string): string {
  const query = extract(prompt, /Query:\s*"([^"]*)"/).toLowerCase();
  const stages: string[] = [];
  if (/pre-?seed/.test(query)) stages.push("pre_seed");
  if (/\bseed\b/.test(query)) stages.push("seed");
  if (/series a/.test(query)) stages.push("series_a");
  if (/series b/.test(query)) stages.push("series_b");
  if (/startup/.test(query) && !stages.length) stages.push("pre_seed", "seed", "series_a");
  const sizes: string[] = [];
  if (/smb|small/.test(query)) sizes.push("1-10", "11-50");
  if (/20[–-]100|11-50|51-200/.test(query)) sizes.push("11-50", "51-200");
  const geos: string[] = [];
  if (/\bus\b|united states|american/.test(query)) geos.push("US");
  if (/\beu\b|europe/.test(query)) geos.push("EU");
  if (/\buk\b|london/.test(query)) geos.push("UK");
  const industries: string[] = [];
  if (/fintech/.test(query)) industries.push("fintech");
  if (/dev ?tool|developer/.test(query)) industries.push("developer tools");
  if (/saas/.test(query)) industries.push("b2b saas");
  if (/health/.test(query)) industries.push("healthtech");
  return JSON.stringify({
    industries: industries.length ? industries : null,
    company_sizes: sizes.length ? sizes : null,
    stages: stages.length ? stages : null,
    geos: geos.length ? geos : null,
    tech: null,
    keywords: null,
    semantic_query: query || "companies matching the workspace ICP",
  });
}

function demoDraft(prompt: string): string {
  const founder = extract(prompt, /FOUNDER: name ([^,]+),/) || "there";
  const wsName = extract(prompt, /company ([^—]+)—/) || "our team";
  const contact = extract(prompt, /CONTACT: ([^,]+),/) || "there";
  const company = extract(prompt, / at ([^|]+)\|/) || "your company";
  const stage = extract(prompt, /relationship stage:\s*(\w+)/) || "cold";
  const trigger = extract(prompt, /TRIGGER SIGNAL\(S\):\s*([^\n]+)/);
  const pain = extract(prompt, /ICP PAIN POINTS:\s*([^\n]+)/).split(",")[0]?.trim() ||
    "missed buying signals";

  const eventLine = trigger.includes("title=")
    ? (trigger.match(/title="([^"]+)"/)?.[1] ?? trigger)
    : trigger || "the recent change on your side";

  const ctas: Record<string, string> = {
    cold: "Open to a 15-minute intro call this week?",
    warm: "Would Tuesday or Thursday afternoon work for a short walk-through?",
    re_engage: "No pressure at all — happy to share what's changed since we last spoke, whenever timing suits.",
  };
  const cta = ctas[stage] ?? ctas.cold;

  return JSON.stringify({
    subject: eventLine.toLowerCase().split(" ").slice(0, 5).join(" "),
    opening: `Hi ${contact.trim().split(" ")[0]} — saw that ${company.trim()} ${eventLine.replace(/^[A-Z]/, (c) => c.toLowerCase())}. That usually changes what the next quarter looks like.`,
    value_prop: `At ${wsName.trim()}, we help teams like yours fix ${pain} right when moments like this open a window.`,
    cta,
    signoff: `Best,\n${founder.trim()}`,
    cta_alternatives: [
      "Worth a short call to compare notes?",
      "Can I send over a two-line summary of how we'd approach this?",
      "If it's useful, I'll share the playbook we use for exactly this moment — no call needed.",
    ],
  });
}

function demoWhyLine(prompt: string): string {
  const type = extract(prompt, /type=(\w+)/);
  const lines: Record<string, string> = {
    funding:
      "Fresh capital means new vendor decisions are being made right now. 71% of funded companies finalize vendors within 90 days.",
    hiring:
      "A new hire for this role means the surrounding tooling is being evaluated. Hiring for a role is the strongest proxy that tool evaluation is underway.",
    exec_change:
      "A new leader rethinks the stack early. New executives spend 70% of their budget in the first 100 days.",
    pricing_visit:
      "Someone on their side is checking your pricing. Pricing-page visits signal late-stage evaluation.",
    champion_move:
      "Your former champion just landed somewhere new. A former champion is 5× warmer than a cold contact.",
  };
  return lines[type] ?? "This event opens a concrete, time-boxed reason to be in touch this week.";
}

function demoBrief(prompt: string): string {
  const signals = extract(prompt, /SIGNALS last 30d:\s*([^\n]+)/);
  const hasSignals = signals.length > 0 && !/none/i.test(signals);
  return JSON.stringify({
    why_this_conversation: hasSignals
      ? `Active buying window: ${signals.slice(0, 200)}. Each event is dated and sourced — lead with the most recent.`
      : "Cold outreach — no signal detected.",
    company_now:
      "The company is an active target matching your ICP. Recent activity suggests priorities are shifting this quarter.",
    people: [],
    talking_points: [
      "Tie the most recent signal to the pain it exposes and how you remove it.",
      "Reference the specific event with its date — specificity earns the reply.",
      "Close with one low-friction ask matched to the relationship stage.",
    ],
    landmines: [],
    history: "First contact.",
  });
}

function demoVoiceProfile(): string {
  return JSON.stringify({
    greeting_forms: ["Hi {first}", "Hey {first}"],
    signoff_forms: ["Best", "Thanks"],
    avg_sentence_words: 12,
    formality: 2,
    uses_contractions: true,
    emoji_freq: "none",
    exclaim_freq: "rare",
    paragraph_style: "short_paras",
    favorite_phrases: ["worth a look", "happy to share"],
    things_they_never_do: ["never uses bullet points", "never writes more than 3 paragraphs"],
    exemplar_candidates: [0, 1, 2],
  });
}

function demoClipRelevance(): string {
  return JSON.stringify({ relevance: "high", matched_pains: ["missed buying signals on target accounts"] });
}

function demoPersonalNote(prompt: string): string {
  const name = extract(prompt, /CONNECTION:\s*([^,]+),/).split(" ")[0] || "friend";
  const type = extract(prompt, /type=(\w+)/);
  const title = extract(prompt, /\|\s*"([^"]+)"/);
  const notes: Record<string, string> = {
    birthday: `Happy birthday, ${name}! Hope the day is full of the good stuff — cake included. Enjoy every minute.`,
    new_baby: `${name} — just saw the news about the little one. Wishing your family all the sleep you can get and every bit of the joy. Say hi to everyone at home.`,
    new_home: `${name}, saw you got the keys to the new place — that's a big milestone. Hope the first week feels like home already.`,
    job_change: `${name} — saw you're starting the new role. They're lucky to have you; hope week one treats you well.`,
    promotion: `${name}, saw the news about the step up — earned the hard way, from what I remember working with you. Enjoy it.`,
    wedding: `${name} — congratulations to you both! Wishing you a wonderful start to the next chapter.`,
    award: `${name}, saw the recognition — good to see the work getting noticed. Hope you took a minute to enjoy it.`,
    speaking: `${name} — caught that you're speaking at the event. Great topic choice; hope the talk lands the way you want it to.`,
    published: `${name}, read the piece you put out — the point about doing it the hard way stuck with me. Good writing.`,
    work_anniversary: `${name} — saw the work anniversary come up. Time flies; hope the ride is still fun.`,
    company_milestone: `${name}, saw the milestone your team hit — that kind of progress doesn't happen by accident. Nicely done.`,
    education: `${name} — saw you finished the program. Finding the hours for that alongside everything else is no small thing.`,
  };
  const note = notes[type] ?? `${name} — saw the news${title ? ` about ${title.toLowerCase()}` : ""}. Genuinely happy for you. Enjoy it.`;
  const channel = ["birthday", "new_baby", "new_home", "wedding"].includes(type) ? "text" : "linkedin_dm";
  return JSON.stringify({ note, channel_hint: channel });
}

/** Returns null for unknown tasks so the router can throw AIBusyError. */
export function demoComplete(task: string, prompt: string): string | null {
  switch (task) {
    case "icp_inference":
      return demoICP(prompt);
    case "nl_filters":
      return demoFilters(prompt);
    case "outreach_draft":
    case "section_regen":
      return demoDraft(prompt);
    case "why_line":
      return demoWhyLine(prompt);
    case "brief":
      return demoBrief(prompt);
    case "voice_profile":
      return demoVoiceProfile();
    case "clip_relevance":
      return demoClipRelevance();
    case "personal_note":
      return demoPersonalNote(prompt);
    case "signal_extract":
      return "[]";
    default:
      return null;
  }
}
