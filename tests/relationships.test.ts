import { describe, expect, it } from "vitest";
import {
  bandFor,
  computeWarmth,
  reconnectQueue,
  upcomingBirthdays,
  isActionableMoment,
  CADENCE_DAYS,
} from "@/lib/relationships/warmth";
import { findIntroPaths, isDecisionMaker, pathsIntoAccounts } from "@/lib/relationships/intro-paths";
import type { Connection, PersonalSignal } from "@/lib/relationships/types";

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

function conn(overrides: Partial<Connection> = {}): Connection {
  return {
    id: "n-test",
    full_name: "Test Person",
    emails: ["test@example.com"],
    phones: [],
    company_domain: null,
    company_name: null,
    title: null,
    linkedin_url: null,
    source: "manual",
    closeness: 80,
    last_interaction_at: daysAgo(5),
    interaction_count: 10,
    birthday: null,
    tags: [],
    notes: "",
    created_at: daysAgo(100),
    ...overrides,
  };
}

describe("warmth scoring", () => {
  it("recent close relationships score hot", () => {
    const w = computeWarmth(conn({ closeness: 90, last_interaction_at: daysAgo(2), interaction_count: 30 }));
    expect(w.band).toBe("hot");
    expect(w.score).toBeGreaterThanOrEqual(70);
  });

  it("never-touched connections are cold and overdue by a full cadence", () => {
    const w = computeWarmth(conn({ last_interaction_at: null, interaction_count: 0 }));
    expect(w.band).toBe("cold");
    expect(w.score).toBeLessThan(20);
    expect(w.reconnectDueInDays).toBe(-CADENCE_DAYS.cold);
  });

  it("warmth decays with time since last touch", () => {
    const fresh = computeWarmth(conn({ last_interaction_at: daysAgo(1) }));
    const stale = computeWarmth(conn({ last_interaction_at: daysAgo(120) }));
    expect(fresh.score).toBeGreaterThan(stale.score);
  });

  it("frequency bonus caps at 15", () => {
    const few = computeWarmth(conn({ interaction_count: 1, closeness: 0 }));
    const many = computeWarmth(conn({ interaction_count: 500, closeness: 0 }));
    expect(many.score - few.score).toBeLessThanOrEqual(15);
    expect(many.score).toBeLessThanOrEqual(15);
  });

  it("bands map to documented thresholds", () => {
    expect(bandFor(75)).toBe("hot");
    expect(bandFor(50)).toBe("warm");
    expect(bandFor(30)).toBe("cooling");
    expect(bandFor(5)).toBe("cold");
  });

  it("reconnectQueue surfaces only due/overdue, coldest first", () => {
    const dueNow = conn({ id: "a", last_interaction_at: daysAgo(100), closeness: 60 });
    const fine = conn({ id: "b", last_interaction_at: daysAgo(1), closeness: 90 });
    const queue = reconnectQueue([dueNow, fine]);
    expect(queue.map((q) => q.connection.id)).toEqual(["a"]);
  });
});

describe("birthday moments", () => {
  it("finds birthdays inside the window regardless of stored year", () => {
    const soon = new Date(Date.now() + 3 * 86_400_000);
    const bd = `1988-${String(soon.getMonth() + 1).padStart(2, "0")}-${String(soon.getDate()).padStart(2, "0")}`;
    const rows = upcomingBirthdays([conn({ birthday: bd })], 14);
    expect(rows).toHaveLength(1);
    expect(rows[0].inDays).toBeGreaterThanOrEqual(2);
    expect(rows[0].inDays).toBeLessThanOrEqual(4);
  });

  it("ignores birthdays outside the window", () => {
    const far = new Date(Date.now() + 60 * 86_400_000);
    const bd = `1988-${String(far.getMonth() + 1).padStart(2, "0")}-${String(far.getDate()).padStart(2, "0")}`;
    expect(upcomingBirthdays([conn({ birthday: bd })], 14)).toHaveLength(0);
  });
});

describe("moment actionability", () => {
  const moment = (over: Partial<PersonalSignal>): PersonalSignal => ({
    id: "ps-1",
    connection_id: "n-test",
    type: "new_baby",
    title: "t",
    detail: "",
    source: "manual",
    source_url: null,
    occurred_at: daysAgo(3),
    status: "new",
    ...over,
  });

  it("new + recent is actionable; acted/dismissed/stale are not", () => {
    expect(isActionableMoment(moment({}))).toBe(true);
    expect(isActionableMoment(moment({ status: "acted" }))).toBe(false);
    expect(isActionableMoment(moment({ status: "dismissed" }))).toBe(false);
    expect(isActionableMoment(moment({ occurred_at: daysAgo(45) }))).toBe(false);
  });
});

describe("intro paths", () => {
  it("detects decision makers from title or tag", () => {
    expect(isDecisionMaker(conn({ title: "VP Revenue Operations" }))).toBe(true);
    expect(isDecisionMaker(conn({ title: "Software Engineer", tags: ["decision_maker"] }))).toBe(true);
    expect(isDecisionMaker(conn({ title: "Software Engineer" }))).toBe(false);
  });

  it("finds direct paths by domain and ranks decision makers higher", () => {
    const exec = conn({ id: "exec", company_domain: "acme.io", title: "CTO", closeness: 70, last_interaction_at: daysAgo(5) });
    const ic = conn({ id: "ic", company_domain: "acme.io", title: "Analyst", closeness: 70, last_interaction_at: daysAgo(5) });
    const other = conn({ id: "other", company_domain: "else.com" });
    const paths = findIntroPaths("www.acme.io", [ic, exec, other]);
    expect(paths.map((p) => p.connection.id)).toEqual(["exec", "ic"]);
    expect(paths[0].strength).toBeGreaterThan(paths[1].strength);
  });

  it("pathsIntoAccounts drops accounts with no paths and sorts by best path", () => {
    const strong = conn({ id: "s", company_domain: "hot.io", title: "CEO", closeness: 95, last_interaction_at: daysAgo(2) });
    const weak = conn({ id: "w", company_domain: "cool.io", title: "Analyst", closeness: 30, last_interaction_at: daysAgo(200) });
    const result = pathsIntoAccounts(
      [
        { accountId: "a1", domain: "cool.io", label: "Cool" },
        { accountId: "a2", domain: "hot.io", label: "Hot" },
        { accountId: "a3", domain: "none.io", label: "None" },
      ],
      [strong, weak],
    );
    expect(result.map((r) => r.accountId)).toEqual(["a2", "a1"]);
  });
});
