/**
 * Draft validation pipeline — docs/06 §5 (deterministic, post-P-5, before render)
 * and quality score — docs/06 §6 (advisory, never blocking).
 */
import { z } from "zod";
import { scanBannedPhrases } from "@/lib/copy";

export const draftSectionsSchema = z.object({
  subject: z.string(),
  opening: z.string(),
  value_prop: z.string(),
  cta: z.string(),
  signoff: z.string(),
  cta_alternatives: z.array(z.string()).default([]),
});

export type DraftSections = z.infer<typeof draftSectionsSchema>;

export interface TriggerKeywords {
  /** round name, amount, new title, person name, path, event noun — docs/06 §5 step 2 */
  tokens: string[];
  eventLabel: string;
}

export interface ValidationResult {
  signalRefPassed: boolean;
  bannedPhrases: string[];
  bodyWords: number;
  lengthOk: boolean;
  flags: string[];
}

export function buildTriggerKeywords(
  type: string,
  title: string,
  payload: Record<string, unknown>,
): TriggerKeywords {
  const tokens = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === "string" && v.length >= 3) tokens.add(v.toLowerCase());
    if (typeof v === "number") tokens.add(String(v));
  };
  add(payload.round);
  add(payload.lead);
  add(payload.job_title);
  add(payload.inferred_category);
  add(payload.person_name);
  add(payload.new_title);
  add(payload.contact_name);
  add(payload.author);
  add(payload.name);
  add(payload.region);
  if (Array.isArray(payload.paths)) payload.paths.forEach(add);
  if (Array.isArray(payload.added)) payload.added.forEach(add);
  if (typeof payload.amount_usd === "number") {
    tokens.add(`$${Math.round(payload.amount_usd / 1_000_000)}m`);
    tokens.add(`${Math.round(payload.amount_usd / 1_000_000)}m`);
  }
  // significant words from the title (event nouns)
  title
    .toLowerCase()
    .split(/[^a-z0-9$.]+/)
    .filter((w) => w.length >= 4)
    .forEach((w) => tokens.add(w));
  return { tokens: Array.from(tokens), eventLabel: title };
}

export function countBodyWords(d: DraftSections): number {
  return [d.opening, d.value_prop, d.cta]
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
}

export function validateDraft(
  draft: DraftSections,
  trigger: TriggerKeywords,
): ValidationResult {
  const opening = draft.opening.toLowerCase();
  const signalRefPassed = trigger.tokens.some((t) => opening.includes(t));

  const fullText = [draft.subject, draft.opening, draft.value_prop, draft.cta, draft.signoff].join(
    " ",
  );
  const bannedPhrases = scanBannedPhrases(fullText);

  const bodyWords = countBodyWords(draft);
  const lengthOk = bodyWords >= 60 && bodyWords <= 140;

  const flags: string[] = [];
  if (!signalRefPassed) flags.push("no_signal_reference");
  if (bannedPhrases.length) flags.push("banned_phrases");
  if (!lengthOk) flags.push("length");

  return { signalRefPassed, bannedPhrases, bodyWords, lengthOk, flags };
}

export interface QualityScore {
  score: number;
  subscores: {
    relevance: number;
    personalization: number;
    cta_clarity: number;
    length_fit: number;
  };
  flags: string[];
}

/**
 * score = 0.35·relevance + 0.30·personalization + 0.20·cta_clarity + 0.15·length_fit
 */
export function computeQuality(
  draft: DraftSections,
  validation: ValidationResult,
  ctx: { contactName?: string; contactTitle?: string; painPoints: string[]; voicePhrases: string[] },
): QualityScore {
  const full = [draft.opening, draft.value_prop, draft.cta].join(" ").toLowerCase();

  const explicitNoun = /\b(series [a-e]|round|role|post|visit|hire|launch|filing|funding)\b/i.test(
    draft.opening,
  );
  const relevance = validation.signalRefPassed ? (explicitNoun ? 100 : 60) : 0;

  let personalization = 0;
  if (
    (ctx.contactName && full.includes(ctx.contactName.toLowerCase())) ||
    (ctx.contactTitle && full.includes(ctx.contactTitle.toLowerCase()))
  )
    personalization += 40;
  if (ctx.painPoints.some((p) => full.includes(p.toLowerCase().split(" ")[0]))) personalization += 30;
  if (ctx.voicePhrases.some((p) => full.includes(p.toLowerCase()))) personalization += 30;

  const asks = (draft.cta.match(/\?/g) ?? []).length + (/(send|share|book|grab a slot)/i.test(draft.cta) && !draft.cta.includes("?") ? 1 : 0);
  const cta_clarity = asks === 1 ? 100 : asks >= 2 ? 40 : 0;

  const w = validation.bodyWords;
  const length_fit =
    w >= 60 && w <= 140 ? 100 : Math.max(0, 100 - 2 * (w < 60 ? 60 - w : w - 140));

  const score = Math.round(
    0.35 * relevance + 0.3 * personalization + 0.2 * cta_clarity + 0.15 * length_fit,
  );

  const flags: string[] = [...validation.flags];
  if (score < 50) {
    const subs = { relevance, personalization, cta_clarity, length_fit };
    const worst = (Object.entries(subs) as [string, number][]).sort((a, b) => a[1] - b[1])[0][0];
    flags.push(`low_${worst}`);
  }

  return { score, subscores: { relevance, personalization, cta_clarity, length_fit }, flags };
}

/** DAR input — docs/06 §6: sent counts as "accepted" if ratio ≤ 0.35. */
export function editDistanceRatio(sent: string, generated: string): number {
  const dist = levenshtein(sent, generated);
  return generated.length === 0 ? 1 : Math.round((dist / generated.length) * 1000) / 1000;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i, ...new Array<number>(n)];
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[n];
}
