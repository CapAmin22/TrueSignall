/**
 * Plan matrix — docs/01 §4-F13 (BL-01..03). Flat plans, zero credits,
 * no overage charges — ever. Single source for limit meters (docs/08 §6).
 */

export type PlanKey = "trial" | "starter" | "growth" | "scale" | "expired";

export interface Plan {
  key: PlanKey;
  name: string;
  priceMonthly: number;
  priceAnnual: number; // 2 months free
  accounts: number;
  contacts: number;
  seats: number;
  draftsPerMonth: number;
  note: string;
  anchor?: boolean;
}

export const PLANS: Record<Exclude<PlanKey, "expired">, Plan> = {
  trial: {
    key: "trial",
    name: "Trial",
    priceMonthly: 0,
    priceAnnual: 0,
    accounts: 50,
    contacts: 250,
    seats: 1,
    draftsPerMonth: 100,
    note: "14 days, full Starter features, no card",
  },
  starter: {
    key: "starter",
    name: "Starter",
    priceMonthly: 99,
    priceAnnual: 990,
    accounts: 50,
    contacts: 500,
    seats: 1,
    draftsPerMonth: 300,
    note: "solo founder",
  },
  growth: {
    key: "growth",
    name: "Growth",
    priceMonthly: 249,
    priceAnnual: 2490,
    accounts: 200,
    contacts: 2000,
    seats: 3,
    draftsPerMonth: 1000,
    note: "founder + first hire",
    anchor: true,
  },
  scale: {
    key: "scale",
    name: "Scale",
    priceMonthly: 499,
    priceAnnual: 4990,
    accounts: 500,
    contacts: 5000,
    seats: 5,
    draftsPerMonth: 3000,
    note: "Series A team; priority sources",
  },
};

export const LIMIT_WARN_RATIO = 0.8; // 80% → LimitBanner + upgrade prompt
export const SEND_SOFT_CAP_PER_DAY = 50; // anti-blast rule, docs/01 §8

export interface UsageMeters {
  accounts: number;
  contacts: number;
  seats: number;
  draftsThisMonth: number;
}

export type MeterKey = "accounts" | "contacts" | "seats" | "drafts";

export function meterStatus(
  plan: Plan,
  usage: UsageMeters,
): { key: MeterKey; used: number; limit: number; ratio: number }[] {
  return [
    { key: "accounts" as const, used: usage.accounts, limit: plan.accounts },
    { key: "contacts" as const, used: usage.contacts, limit: plan.contacts },
    { key: "seats" as const, used: usage.seats, limit: plan.seats },
    { key: "drafts" as const, used: usage.draftsThisMonth, limit: plan.draftsPerMonth },
  ].map((m) => ({ ...m, ratio: m.limit === 0 ? 0 : m.used / m.limit }));
}
