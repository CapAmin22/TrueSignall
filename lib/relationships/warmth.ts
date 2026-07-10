import { clamp } from "@/lib/utils";
import type { Connection, WarmthBand, WarmthResult, PersonalSignal } from "./types";

/**
 * Warmth scoring — deterministic, explainable, no AI.
 * warmth = clamp(closeness × recency_decay + frequency_bonus, 0, 100)
 *
 * recency_decay: exp(-days_since_touch / 45) — a 45-day half-life-ish curve;
 * an untouched relationship cools on the same clock founders feel it cool.
 * frequency_bonus: up to +15 for a real interaction history (10+ touches).
 */
const RECENCY_TAU_DAYS = 45;
const FREQUENCY_BONUS_CAP = 15;

/** Keep-warm cadence per band — how often the founder should touch base. */
export const CADENCE_DAYS: Record<WarmthBand, number> = {
  hot: 21,
  warm: 35,
  cooling: 50,
  cold: 90,
};

export function bandFor(score: number): WarmthBand {
  if (score >= 70) return "hot";
  if (score >= 45) return "warm";
  if (score >= 20) return "cooling";
  return "cold";
}

export function computeWarmth(connection: Connection, now: Date = new Date()): WarmthResult {
  const last = connection.last_interaction_at ? new Date(connection.last_interaction_at) : null;
  const daysSince = last
    ? Math.max(0, (now.getTime() - last.getTime()) / 86_400_000)
    : Number.POSITIVE_INFINITY;

  const decay = last ? Math.exp(-daysSince / RECENCY_TAU_DAYS) : 0;
  const frequencyBonus = Math.min(
    FREQUENCY_BONUS_CAP,
    (connection.interaction_count / 10) * FREQUENCY_BONUS_CAP,
  );

  const score = Math.round(clamp(connection.closeness * decay + frequencyBonus, 0, 100));
  const band = bandFor(score);
  const cadence = CADENCE_DAYS[band];
  const reconnectDueInDays = last
    ? Math.round(cadence - daysSince)
    : -cadence; // never touched → overdue by a full cadence

  return { score, band, reconnectDueInDays };
}

/** Connections whose keep-warm touch is due or overdue, coldest-first. */
export function reconnectQueue(connections: Connection[], now: Date = new Date()) {
  return connections
    .map((connection) => ({ connection, warmth: computeWarmth(connection, now) }))
    .filter(({ warmth }) => warmth.reconnectDueInDays <= 0)
    .sort((a, b) => a.warmth.reconnectDueInDays - b.warmth.reconnectDueInDays);
}

/**
 * Upcoming-birthday moments derived from stored birthdays (no external
 * source needed) — surfaced `withinDays` ahead, today first.
 */
export function upcomingBirthdays(
  connections: Connection[],
  withinDays = 14,
  now: Date = new Date(),
): { connection: Connection; inDays: number }[] {
  // Whole-day math: compare start-of-day to start-of-day so a birthday
  // stays "today" until midnight, whatever the current clock time.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const results: { connection: Connection; inDays: number }[] = [];
  for (const connection of connections) {
    if (!connection.birthday) continue;
    const bd = new Date(connection.birthday);
    if (Number.isNaN(bd.getTime())) continue;
    const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
    if (next.getTime() < today.getTime()) next.setFullYear(today.getFullYear() + 1);
    const inDays = Math.round((next.getTime() - today.getTime()) / 86_400_000);
    if (inDays <= withinDays) results.push({ connection, inDays });
  }
  return results.sort((a, b) => a.inDays - b.inDays);
}

/** True when a stored moment is still actionable (new + recent). */
export function isActionableMoment(moment: PersonalSignal, now: Date = new Date()): boolean {
  if (moment.status !== "new") return false;
  const ageDays = (now.getTime() - new Date(moment.occurred_at).getTime()) / 86_400_000;
  return ageDays <= 30;
}
