import { normalizeDomain } from "@/lib/utils";
import { computeWarmth } from "./warmth";
import type { Connection, IntroPath } from "./types";

/**
 * Warm-intro path finder — the network-expansion loop:
 * a target account shows strong signals → who in the founder's OWN network
 * already works there (direct) or is tagged as knowing the space (adjacent)?
 * strength = warmth × seniority relevance, so the best path is a close
 * contact who is also a decision maker.
 */
const DECISION_MAKER_TITLE =
  /\b(ceo|cto|coo|cfo|cmo|cro|founder|co-?founder|president|owner|partner|vp|vice president|head of|director|chief)\b/i;

export function isDecisionMaker(connection: Connection): boolean {
  if (connection.tags.includes("decision_maker")) return true;
  return Boolean(connection.title && DECISION_MAKER_TITLE.test(connection.title));
}

function seniorityWeight(connection: Connection): number {
  return isDecisionMaker(connection) ? 1.0 : 0.7;
}

/** Direct paths: connections whose company matches the target domain. */
export function findIntroPaths(
  targetDomain: string,
  connections: Connection[],
  now: Date = new Date(),
): IntroPath[] {
  const domain = normalizeDomain(targetDomain);
  return connections
    .filter((c) => c.company_domain && normalizeDomain(c.company_domain) === domain)
    .map((connection) => {
      const warmth = computeWarmth(connection, now);
      const strength = Math.round(warmth.score * seniorityWeight(connection));
      return {
        connection,
        companyDomain: domain,
        strength,
        reason: `${connection.full_name} is ${connection.title ?? "a contact"} there — ${warmth.band} relationship${
          isDecisionMaker(connection) ? ", decision maker" : ""
        }`,
      };
    })
    .sort((a, b) => b.strength - a.strength);
}

/**
 * Paths into many accounts at once — powers "who can open doors into my
 * hottest accounts" on the Network screen. Returns only accounts with ≥1 path.
 */
export function pathsIntoAccounts(
  targets: { accountId: string; domain: string; label: string }[],
  connections: Connection[],
  now: Date = new Date(),
): { accountId: string; label: string; paths: IntroPath[] }[] {
  return targets
    .map((t) => ({
      accountId: t.accountId,
      label: t.label,
      paths: findIntroPaths(t.domain, connections, now),
    }))
    .filter((t) => t.paths.length > 0)
    .sort((a, b) => (b.paths[0]?.strength ?? 0) - (a.paths[0]?.strength ?? 0));
}
