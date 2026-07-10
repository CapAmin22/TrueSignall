/**
 * Urgency score — docs/05 §7, implemented exactly.
 *
 * urgency(account) = clamp( Σ_i [ W(type_i) × D_i × M_i ] × F + B, 0, 100 )
 *   D_i = 0.5 ^ (hours_since_occurred_i / halflife(type_i))     recency decay
 *   M_i = seniority multiplier, personal signals only            c_suite 1.3 · vp 1.15 · else 1.0
 *   F   = 0.6 + 0.8 × (fit_score/100)                            0.6 … 1.4
 *   B   = 10 × (distinct types in trailing 72h − 1), cap 30      stacking bonus
 *
 * Window: signals from the last 21 days. ≥70 ⇒ Hot.
 */
import { clamp, hoursSince } from "@/lib/utils";
import type { SignalType } from "@/lib/signals/taxonomy";

interface WeightRow {
  weight: number;
  halflifeHours: number;
}

/** Weights & halflives — docs/05 §7 table (v1 priors). */
export function weightFor(
  type: SignalType,
  payload: Record<string, unknown> = {},
): WeightRow {
  switch (type) {
    case "pricing_visit":
      return { weight: payload.person ? 34 : 28, halflifeHours: 24 };
    case "funding":
      return { weight: 32, halflifeHours: 168 };
    case "champion_move":
      return { weight: 30, halflifeHours: 336 };
    case "exec_change":
      return { weight: 26, halflifeHours: 240 };
    case "linkedin_clip":
      return { weight: 22, halflifeHours: 96 };
    case "hiring": {
      const conf = payload.confidence;
      const weight = conf === "high" ? 20 : conf === "medium" ? 14 : 8;
      return { weight, halflifeHours: 240 };
    }
    case "site_visit":
      return { weight: 18, halflifeHours: 72 };
    case "product_launch":
    case "geo_expansion":
      return { weight: 14, halflifeHours: 168 };
    case "tech_change":
      return {
        weight: payload.flag === "competitive" ? 20 : 14,
        halflifeHours: 336,
      };
    case "news":
      return { weight: 8, halflifeHours: 72 };
    default:
      return { weight: 8, halflifeHours: 72 };
  }
}

const PERSONAL_TYPES: SignalType[] = ["champion_move", "linkedin_clip", "conference"];

export function seniorityMultiplier(type: SignalType, seniority?: string): number {
  if (!PERSONAL_TYPES.includes(type)) return 1.0;
  if (seniority === "c_suite") return 1.3;
  if (seniority === "vp") return 1.15;
  return 1.0;
}

export function fitMultiplier(fitScore: number): number {
  return 0.6 + 0.8 * (fitScore / 100);
}

export interface ScorableSignal {
  type: SignalType;
  occurred_at: string;
  payload?: Record<string, unknown>;
  seniority?: string;
}

export interface UrgencyTerm {
  type: SignalType;
  W: number;
  decay: number;
  contrib: number;
}

export interface UrgencyExplain {
  terms: UrgencyTerm[];
  F: number;
  B: number;
  score: number;
}

const WINDOW_DAYS = 21;
const STACK_WINDOW_HOURS = 72;

/** Account urgency over its last-21-day signals. Returns score + explain payload (ring tooltip). */
export function computeUrgency(
  signals: ScorableSignal[],
  fitScore: number,
  now: Date = new Date(),
): UrgencyExplain {
  const recent = signals.filter(
    (s) => hoursSince(s.occurred_at, now) <= WINDOW_DAYS * 24,
  );

  const terms: UrgencyTerm[] = recent.map((s) => {
    const { weight, halflifeHours } = weightFor(s.type, s.payload ?? {});
    const decay = Math.pow(0.5, hoursSince(s.occurred_at, now) / halflifeHours);
    const M = seniorityMultiplier(s.type, s.seniority);
    return {
      type: s.type,
      W: weight,
      decay: Math.round(decay * 1000) / 1000,
      contrib: weight * decay * M,
    };
  });

  const F = fitMultiplier(fitScore);
  const distinct72h = new Set(
    recent
      .filter((s) => hoursSince(s.occurred_at, now) <= STACK_WINDOW_HOURS)
      .map((s) => s.type),
  ).size;
  const B = Math.min(30, Math.max(0, 10 * (distinct72h - 1)));

  const raw = terms.reduce((acc, t) => acc + t.contrib, 0) * F + B;
  const score = Math.round(clamp(raw, 0, 100));

  return { terms, F: Math.round(F * 100) / 100, B, score };
}

/** Delivery urgency = its signal's term × F (+ B if in a stack) — docs/05 §7. */
export function computeDeliveryUrgency(
  signal: ScorableSignal,
  fitScore: number,
  inStack: boolean,
  stackBonus: number,
  now: Date = new Date(),
): number {
  const { weight, halflifeHours } = weightFor(signal.type, signal.payload ?? {});
  const decay = Math.pow(0.5, hoursSince(signal.occurred_at, now) / halflifeHours);
  const M = seniorityMultiplier(signal.type, signal.seniority);
  const term = weight * decay * M * fitMultiplier(fitScore);
  return Math.round(clamp(term + (inStack ? stackBonus : 0), 0, 100));
}

export const HOT_THRESHOLD = 70;

export function urgencyBand(score: number): "hot" | "warm" | "quiet" {
  if (score >= HOT_THRESHOLD) return "hot";
  if (score >= 40) return "warm";
  return "quiet";
}
