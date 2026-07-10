/** In-memory token buckets for route handlers — docs/07 §2–3 rate ceilings. */

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();

/** Allow `limit` requests per `windowMs` per key (e.g. hashed IP). */
export function allowRequest(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: limit, updatedAt: now };
  const refill = ((now - bucket.updatedAt) / windowMs) * limit;
  bucket.tokens = Math.min(limit, bucket.tokens + refill);
  bucket.updatedAt = now;
  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  // opportunistic cleanup
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) {
      if (now - b.updatedAt > windowMs * 10) buckets.delete(k);
    }
  }
  return true;
}

/** Constant-time compare for CRON_SECRET bearer auth — docs/07 §1. */
export function verifyCronSecret(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const provided = header.replace(/^Bearer\s+/i, "");
  if (provided.length !== secret.length) return false;
  let mismatch = 0;
  for (let i = 0; i < secret.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return mismatch === 0;
}
