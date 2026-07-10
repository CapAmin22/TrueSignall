/**
 * Regex-first RSS classifiers — docs/05 §5.1.
 * Regex miss but company-relevant → cheap LLM extract (P-3, batched).
 */

export const FUNDING_REGEX =
  /(raises?|raised|secures?|closes?|lands)\s+\$?[\d.]+\s*(m|million|b|billion)/i;

export const ROUND_REGEX = /(pre-?seed|seed|series [a-e]\+?)/i;

export const EXEC_REGEX =
  /(joins?|appoint(s|ed)|name[sd]|hires?)\s+.{0,40}(as\s+)?(chief|cto|ceo|cro|cmo|cfo|coo|vp|president)/i;

export interface ClassifiedItem {
  isSignal: boolean;
  type: "funding" | "exec_change" | null;
  round?: string;
  amountUsd?: number;
}

export function classifyHeadline(title: string): ClassifiedItem {
  const fundingMatch = title.match(FUNDING_REGEX);
  if (fundingMatch) {
    const amountMatch = title.match(/\$?([\d.]+)\s*(m|million|b|billion)/i);
    let amountUsd: number | undefined;
    if (amountMatch) {
      const n = parseFloat(amountMatch[1]);
      const mult = /b/i.test(amountMatch[2]) ? 1_000_000_000 : 1_000_000;
      amountUsd = Math.round(n * mult);
    }
    const round = title.match(ROUND_REGEX)?.[0];
    return { isSignal: true, type: "funding", round, amountUsd };
  }
  if (EXEC_REGEX.test(title)) {
    return { isSignal: true, type: "exec_change" };
  }
  return { isSignal: false, type: null };
}
