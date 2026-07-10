# 06 · SIGNAL AI — AI System Specification

**Scope:** every LLM touchpoint in the product — provider abstraction, the seven production prompts (verbatim, copy into `/lib/ai/prompts/`), voice calibration, draft validation + quality scoring, caching, and the free-tier quota math that makes it all run at $0.
**Prime directive baked into every prompt:** *never fabricate.* The model may only state facts present in the supplied context; unknown → `null`/omit. Every user-visible claim about a prospect traces to a signal `source_url` or the founder's own inputs.

---

## 1. Provider Router (`/lib/ai/router.ts`)
```
callLLM({task, messages, schema?, priority}) →
  1. pick model by task table (§2)
  2. acquire token from per-provider minute-bucket (Gemini 15 RPM shared; Groq 30 RPM)
     · priority 'interactive' preempts; 'background' waits up to 10 min then requeues
  3. call provider; on 429/5xx/timeout(20s) → fallback chain → next provider
  4. if schema: parse (strip ``` fences) → zod validate → 1 corrective retry ("Return ONLY valid JSON matching…")
  5. log {task, provider, ms, in_tokens, out_tokens, ok} to ai_calls (PostHog + daily counter)
Fallback chains: quality → [gemini-2.5-flash, groq-llama-3.3-70b] · cheap → [gemini-2.5-flash-lite, gemini-2.5-flash, groq-llama-3.3-70b]
Env: GEMINI_API_KEY, GROQ_API_KEY. Adding Claude later = one entry in providers[] (post-revenue).
```
Degradation UX: interactive call exhausts chain → typed `AIBusyError` → UI "AI is busy — retry in 60s" (never a blank failure). Background tasks are simply retried next cron tick.

## 2. Task → Model → Budget Matrix
| ID | Task | Chain | Priority | ~in/out tok | Cache | Volume/day @100u |
|---|---|---|---|---|---|---|
| P-1 | ICP inference | quality | interactive | 900/350 | none | ~15 |
| P-2 | NL→filters (Discover) | cheap | interactive | 400/150 | LRU(norm query, 24h) | ~60 |
| P-3 | Signal extract / title classify | cheap | background (batch 10) | 700/200 | classify→library table (permanent) | ~150 (falls as library grows) |
| P-4 | Why-this-matters line | cheap | background | 500/80 | **per global signal, forever** | ~900 |
| P-5 | Outreach draft / section regen | quality | interactive | 1,400/400 | none | ~300 + regens |
| P-6 | Voice profile extraction | quality | background | 6,000/600 | per user until recalibration | ~5 |
| P-7 | Pre-call brief | quality | interactive | 2,000/500 | 6h per account | ~80 |
Totals ≈ 1,300 calls/day worst case → fits Gemini free RPD across the two models with Groq absorbing spikes (03 §1). **Hard backstops:** per-plan draft quotas (trial 100 / starter 300 / growth 1,000 / scale 3,000 per month, `usage_counters`) and the minute-bucket governor. First paid dollar if ever needed: Gemini Flash-Lite paid tier ≈ pennies/day at this volume.

## 3. Shared System Preamble (prepended to every prompt)
```
You are the AI engine inside Signal AI, a GTM tool for B2B founders. Rules that override everything:
1. Use ONLY facts provided in the context. Never invent names, numbers, quotes, features, or events.
2. If information is missing, output null or omit it — never guess.
3. Output format: exactly what the task specifies. JSON tasks: return ONLY minified JSON, no markdown, no commentary.
4. Tone: plain, specific, human. Never use marketing hype, emojis, or the words "exciting", "innovative", "leverage", "synergy".
```

## 4. Production Prompts (verbatim)

**P-1 · ICP inference** (OB-02; input: `{domain, homepage_text≤3000ch, one_liner}`)
```
TASK: Infer the ideal customer profile for this company's product.
CONTEXT: domain: {{domain}} | founder's one-liner: "{{one_liner}}" | homepage excerpt: {{homepage_text}}
Return JSON: {"industries":[≤4 strings],"company_sizes":[subset of "1-10","11-50","51-200","201-500","501-1000","1000+"],
"stages":[subset of "pre_seed","seed","series_a","series_b","series_c_plus"],"seniorities":[≤3 of "c_suite","vp","director","manager"],
"geos":[≤3 ISO regions e.g. "US","EU","UK"],"pain_points":[3-5 short phrases, each ≤8 words, concrete problems the BUYER has],
"buyer_titles":[3-5 exact job titles],"confidence":"high"|"medium"|"low"}
Pain points must be problems (e.g. "missed buying signals on target accounts"), not features. If the one-liner and homepage conflict, trust the one-liner.
```

**P-2 · NL query → Discover filters** (AD-01)
```
TASK: Convert this search query into structured filters. Query: "{{query}}"
Return JSON: {"industries":[]|null,"company_sizes":[]|null,"stages":[]|null,"geos":[]|null,
"tech":[]|null,"keywords":[]|null,"semantic_query":"one sentence restating what the user wants"}
Map colloquial terms: "startups"→stages pre_seed..series_a; "SMB"→sizes 1-10,11-50; city names→their country code in geos.
Unmentioned dimensions → null (do NOT restrict). keywords = only distinctive terms worth text-matching (product category, vertical).
```

**P-3 · Signal extraction fallback** (05 §5.1; batched: array in → array out)
```
TASK: For each news item, decide if it contains a buying signal about a specific company.
ITEMS: {{json array of {id,title,summary,link}}}
Return JSON array, same order: {"id":…,"is_signal":bool,"type":"funding"|"exec_change"|"product_launch"|"geo_expansion"|"news"|null,
"company_name":string|null,"company_domain":string|null (only if stated in item),
"payload":{…type contract fields from the spec, only values stated in the item},"headline":"≤12 word factual title"}
An item about industry trends, opinion, or lists of many companies → is_signal:false.
--- variant P-3b · job-title classify: given {"title","description_excerpt"} return
{"category": one of the 12 category keys | "other","confidence":"high"|"medium"|"low"} — category keys: {{list}}.
```

**P-4 · Why-this-matters line** (SA-03; one call per global signal, cached in `signals.why_line`)
```
TASK: Write the "why this matters now" line for a sales signal card. 1–2 sentences, ≤40 words total.
SIGNAL: type={{type}} | title="{{title}}" | payload={{payload}} | occurred={{relative_time}}
ANCHOR STATS (use AT MOST one, only if the type matches): funding→"71% of funded companies finalize vendors within 90 days" ·
exec_change/new leader→"new executives spend 70% of their budget in the first 100 days" · champion_move→"a former champion is 5× warmer than a cold contact" ·
pricing_visit→"pricing-page visits signal late-stage evaluation" · hiring→"hiring for a role is the strongest proxy that tool evaluation is underway".
Sentence 1: what just happened and the concrete opening it creates. Sentence 2 (optional): the anchor stat, verbatim from the list.
No greetings, no "you should", no exclamation marks. Output plain text only.
```
Deterministic fallback (renders until the job fills `why_line`): templated per type, e.g. funding → `"New funding usually means new budget and vendor decisions within the quarter."`

**P-5 · Outreach draft** (OC-01..04; the flagship)
```
TASK: Draft a cold-but-warm outreach email FROM the founder TO the contact, triggered by a specific signal.
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
"cta":"1 sentence, rule 3","signoff":"matches voice profile","cta_alternatives":[3 more CTA sentences, same stage, different friction levels]}
--- variant P-5b · section regenerate: same context + current draft JSON + "Rewrite ONLY the {{section}} section. Keep every other section verbatim. Vary the approach, keep the rules." → return full JSON.
--- variant P-5c · LinkedIn (OC-07, v1.1): same context; return {"connection_note":"≤300 chars","message":"≤1000 chars"} — must reference the event with DIFFERENT phrasing than the email.
```

**P-6 · Voice profile extraction** (OC-02; transient input — bodies are NEVER stored, 09 §3)
```
TASK: Analyze these {{n}} emails the founder wrote and extract a reusable style profile.
EMAILS (transient, do not quote more than 8 consecutive words from any): {{bodies}}
Return JSON: {"greeting_forms":[…],"signoff_forms":[…],"avg_sentence_words":int,"formality":1-5,
"uses_contractions":bool,"emoji_freq":"none"|"rare"|"often","exclaim_freq":"none"|"rare"|"often",
"paragraph_style":"single_block"|"short_paras"|"one_liners","favorite_phrases":[≤8, each ≤4 words, EXCLUDING generic filler],
"things_they_never_do":[≤5 observations e.g. "never uses bullet points"],
"exemplar_candidates":[3-5 indices of the emails that best represent their outreach style]}
```
Flow: fetch last 50 sent (format=full, in memory only) → P-6 → show profile + the candidate exemplars → **user approves/edits exemplars** → store profile + approved snippets in `voice_profiles` → discard bodies. No Gmail: paste 3–5 samples into the same flow. Weekly recalibration uses only messages sent *through Signal AI*.

**P-7 · Pre-call brief** (PC-01/02; cache 6h)
```
TASK: Write a pre-call brief a founder reads on their phone in 2 minutes.
ACCOUNT: {{company facts}} | SIGNALS last 30d: {{list w/ dates+urls}} | CONTACTS: {{known people w/ titles, tags}} |
OUTREACH HISTORY: {{sent/replied summary}} | OUR PRODUCT: {{one_liner}} | ICP PAINS: {{list}} | COMPETITORS DETECTED: {{list|none}}
Return JSON, every string ≤100 words: {"why_this_conversation":"the triggering signals and what they imply — or exactly 'Cold outreach — no signal detected.' if none",
"company_now":"2 sentences: what the company is + what changed recently","people":[{name,title,one_relevant_fact_or_null}],
"talking_points":[3 bullets, each tying a detected signal to a pain we solve],"landmines":[0-2 things NOT to say, e.g. competitor in stack, past no-reply],
"history":"1 sentence on prior touches or 'First contact.'"}
Facts only from context; no speculation about company strategy.
```

## 5. Draft Validation Pipeline (deterministic, post-P-5, before render)
1. JSON parse + zod. 2. **Signal-reference check:** opening must contain ≥1 token from the trigger's keyword set (round name, amount, new title, person name, path, event noun) — fail → one silent corrective regen ("Your opening did not reference {{event}}. Rewrite opening only.") → still failing → render with amber flag "doesn't mention the trigger — edit before sending". 3. Banned-phrase scan (whole draft). 4. Length: body words w; ideal 60–140. 5. Compute quality (§6). Deliveries with validation flags never auto-count against DAR.

## 6. Quality Score (OC-08 groundwork; advisory, never blocking)
`score = 0.35·relevance + 0.30·personalization + 0.20·cta_clarity + 0.15·length_fit` (each 0–100)
relevance: 100 if signal-ref check passed +explicit event noun; 60 if generic event mention; 0 fail · personalization: +40 contact name/title used correctly, +30 pain-point term present, +30 voice-profile phrase or structure match · cta_clarity: exactly one interrogative/imperative ask=100; two asks=40; none=0 · length_fit: 100 within 60–140 words, −2/word outside. <50 → amber warning chip with the failing subscore named. Store in `outreach_drafts.quality`. **DAR** computed at send: `edit_distance_ratio = levenshtein(sent, generated)/len(generated)`; sent counts as "accepted" if ratio ≤0.35.

## 7. Embeddings (Discover ranking)
Gemini `text-embedding-004` (768-d, free tier): embed each company's `name+description+industry` at enrichment; embed the ICP paragraph once per workspace (re-embed on ICP edit). Discover ranks facet-filtered rows by cosine similarity. Budget: seed corpus 8K one-off (batched over 2 nights), then ~50/day marginal.

## 8. Evaluation Harness (ship at M5, run before beta)
`/scripts/eval-drafts.ts`: 25 golden signal fixtures (5/type) × P-5 → assert: JSON valid 100% · signal-ref pass ≥92% first try · banned phrases 0 · mean quality ≥70 · manual spot-read 10 drafts sounds-like-founder check. Regression-run on any prompt edit; prompts are versioned files, version stamped into `outreach_drafts.meta`.
