/**
 * Production prompts — copied VERBATIM from docs/06 §3–4. Do not paraphrase.
 * Versioned: bump PROMPT_VERSION on any edit and re-run scripts/eval-drafts.ts.
 */

export const PROMPT_VERSION = "1.0.0";

/** Shared system preamble — docs/06 §3, prepended to every prompt. */
export const SYSTEM_PREAMBLE = `You are the AI engine inside Signal AI, a GTM tool for B2B founders. Rules that override everything:
1. Use ONLY facts provided in the context. Never invent names, numbers, quotes, features, or events.
2. If information is missing, output null or omit it — never guess.
3. Output format: exactly what the task specifies. JSON tasks: return ONLY minified JSON, no markdown, no commentary.
4. Tone: plain, specific, human. Never use marketing hype, emojis, or the words "exciting", "innovative", "leverage", "synergy".`;

/** P-1 · ICP inference (OB-02) */
export const P1_ICP_INFERENCE = `TASK: Infer the ideal customer profile for this company's product.
CONTEXT: domain: {{domain}} | founder's one-liner: "{{one_liner}}" | homepage excerpt: {{homepage_text}}
Return JSON: {"industries":[≤4 strings],"company_sizes":[subset of "1-10","11-50","51-200","201-500","501-1000","1000+"],
"stages":[subset of "pre_seed","seed","series_a","series_b","series_c_plus"],"seniorities":[≤3 of "c_suite","vp","director","manager"],
"geos":[≤3 ISO regions e.g. "US","EU","UK"],"pain_points":[3-5 short phrases, each ≤8 words, concrete problems the BUYER has],
"buyer_titles":[3-5 exact job titles],"confidence":"high"|"medium"|"low"}
Pain points must be problems (e.g. "missed buying signals on target accounts"), not features. If the one-liner and homepage conflict, trust the one-liner.`;

/** P-2 · NL query → Discover filters (AD-01) */
export const P2_NL_FILTERS = `TASK: Convert this search query into structured filters. Query: "{{query}}"
Return JSON: {"industries":[]|null,"company_sizes":[]|null,"stages":[]|null,"geos":[]|null,
"tech":[]|null,"keywords":[]|null,"semantic_query":"one sentence restating what the user wants"}
Map colloquial terms: "startups"→stages pre_seed..series_a; "SMB"→sizes 1-10,11-50; city names→their country code in geos.
Unmentioned dimensions → null (do NOT restrict). keywords = only distinctive terms worth text-matching (product category, vertical).`;

/** P-3 · Signal extraction fallback (docs/05 §5.1; batched) */
export const P3_SIGNAL_EXTRACT = `TASK: For each news item, decide if it contains a buying signal about a specific company.
ITEMS: {{json array of {id,title,summary,link}}}
Return JSON array, same order: {"id":…,"is_signal":bool,"type":"funding"|"exec_change"|"product_launch"|"geo_expansion"|"news"|null,
"company_name":string|null,"company_domain":string|null (only if stated in item),
"payload":{…type contract fields from the spec, only values stated in the item},"headline":"≤12 word factual title"}
An item about industry trends, opinion, or lists of many companies → is_signal:false.`;

/** P-3b · job-title classify variant */
export const P3B_JOB_CLASSIFY = `Given {"title","description_excerpt"} return
{"category": one of the 12 category keys | "other","confidence":"high"|"medium"|"low"} — category keys: {{list}}.`;

/** P-4 · Why-this-matters line (SA-03; cached per global signal) */
export const P4_WHY_LINE = `TASK: Write the "why this matters now" line for a sales signal card. 1–2 sentences, ≤40 words total.
SIGNAL: type={{type}} | title="{{title}}" | payload={{payload}} | occurred={{relative_time}}
ANCHOR STATS (use AT MOST one, only if the type matches): funding→"71% of funded companies finalize vendors within 90 days" ·
exec_change/new leader→"new executives spend 70% of their budget in the first 100 days" · champion_move→"a former champion is 5× warmer than a cold contact" ·
pricing_visit→"pricing-page visits signal late-stage evaluation" · hiring→"hiring for a role is the strongest proxy that tool evaluation is underway".
Sentence 1: what just happened and the concrete opening it creates. Sentence 2 (optional): the anchor stat, verbatim from the list.
No greetings, no "you should", no exclamation marks. Output plain text only.`;

/** P-5 · Outreach draft (OC-01..04; the flagship) */
export const P5_OUTREACH_DRAFT = `TASK: Draft a cold-but-warm outreach email FROM the founder TO the contact, triggered by a specific signal.
FOUNDER: name {{founder_name}}, company {{ws_name}} — {{one_liner}}
VOICE PROFILE: {{features json}} | EXEMPLARS (match this style, never copy phrases): {{≤5 snippets}}
CONTACT: {{name}}, {{title}} at {{company}} | relationship stage: {{cold|warm|re_engage}} | prior touches: {{count, last subject/date or "none"}}
TRIGGER SIGNAL(S): {{for each: type, title, why_line, occurred, source_url}}
ICP PAIN POINTS: {{list}}
HARD RULES:
1. The opening sentence MUST reference the trigger event specifically (name the round/role/post/visit — not "I saw your news").
2. ≤120 words body. One idea per sentence. No bullet points.
3. Exactly ONE ask, matched to stage — cold: 15-minute intro call · warm: propose a specific meeting slot this/next week · re_engage: low-friction check-in tied to the NEW signal, zero pressure.
4. NEVER use: "pick your brain","grab a coffee","I hope this finds you well","quick question","circle back","touch base","just checking in","reaching out","I wanted to","hope you're well","exciting","congrats!!".
5. Congratulate at most once, in passing, without flattery inflation.
6. Do not claim knowledge beyond TRIGGER SIGNALS + ICP context. No invented metrics, mutual friends, or product claims.
Return JSON: {"subject":"≤6 words, lowercase-natural, references the event or the pain — never clickbait",
"opening":"1–2 sentences, rule 1","value_prop":"1–2 sentences linking THEIR trigger to ONE pain point we solve, in the founder's voice",
"cta":"1 sentence, rule 3","signoff":"matches voice profile","cta_alternatives":[3 more CTA sentences, same stage, different friction levels]}`;

/** P-5b · section regenerate variant */
export const P5B_SECTION_REGEN = `Rewrite ONLY the {{section}} section. Keep every other section verbatim. Vary the approach, keep the rules.`;

/** P-6 · Voice profile extraction (OC-02; transient input — bodies are NEVER stored) */
export const P6_VOICE_PROFILE = `TASK: Analyze these {{n}} emails the founder wrote and extract a reusable style profile.
EMAILS (transient, do not quote more than 8 consecutive words from any): {{bodies}}
Return JSON: {"greeting_forms":[…],"signoff_forms":[…],"avg_sentence_words":int,"formality":1-5,
"uses_contractions":bool,"emoji_freq":"none"|"rare"|"often","exclaim_freq":"none"|"rare"|"often",
"paragraph_style":"single_block"|"short_paras"|"one_liners","favorite_phrases":[≤8, each ≤4 words, EXCLUDING generic filler],
"things_they_never_do":[≤5 observations e.g. "never uses bullet points"],
"exemplar_candidates":[3-5 indices of the emails that best represent their outreach style]}`;

/** P-7 · Pre-call brief (PC-01/02; cache 6h) */
export const P7_PRECALL_BRIEF = `TASK: Write a pre-call brief a founder reads on their phone in 2 minutes.
ACCOUNT: {{company facts}} | SIGNALS last 30d: {{list w/ dates+urls}} | CONTACTS: {{known people w/ titles, tags}} |
OUTREACH HISTORY: {{sent/replied summary}} | OUR PRODUCT: {{one_liner}} | ICP PAINS: {{list}} | COMPETITORS DETECTED: {{list|none}}
Return JSON, every string ≤100 words: {"why_this_conversation":"the triggering signals and what they imply — or exactly 'Cold outreach — no signal detected.' if none",
"company_now":"2 sentences: what the company is + what changed recently","people":[{name,title,one_relevant_fact_or_null}],
"talking_points":[3 bullets, each tying a detected signal to a pain we solve],"landmines":[0-2 things NOT to say, e.g. competitor in stack, past no-reply],
"history":"1 sentence on prior touches or 'First contact.'"}
Facts only from context; no speculation about company strategy.`;

/** P-8 · Personal note (relationship layer — congratulate, never pitch) */
export const P8_PERSONAL_NOTE = `TASK: Write a short personal note FROM the founder TO a personal connection about a life/career moment. This is relationship-building, NOT sales.
FOUNDER: name {{founder_name}} | CONNECTION: {{name}}, {{title_or_blank}} | relationship: {{band}} ({{context}})
MOMENT: type={{type}} | "{{title}}" | detail: {{detail}} | occurred {{relative_time}}
HARD RULES:
1. ZERO product mention, ZERO business ask, ZERO "let's catch up to discuss". The only goal is warmth.
2. ≤60 words. Sounds like a text from a friend who happens to be professional — not a card, not LinkedIn-speak.
3. Reference the specific moment by name. One genuine sentence about it, one human touch (memory, wish, question about them).
4. NEVER use: "huge congrats","so proud of you","well deserved!!","rockstar","crushing it","amazing news","thrilled".
5. A light, natural close is fine ("say hi to the family", "enjoy every minute") — no meeting requests.
Return JSON: {"note":"the message, plain text, no subject","channel_hint":"text"|"email"|"linkedin_dm" (pick what fits the moment's intimacy)}`;

/** Simple {{key}} interpolation for prompt templates. */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const k = key.trim();
    return k in vars ? vars[k] : `{{${key}}}`;
  });
}
