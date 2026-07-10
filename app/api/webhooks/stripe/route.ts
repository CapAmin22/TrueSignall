/**
 * POST /api/webhooks/stripe — billing lifecycle (docs/07 §3, 08 §6).
 * Signature-verified (t/v1 HMAC scheme, 5-min tolerance); idempotent via
 * event-id ledger; handles checkout.session.completed,
 * customer.subscription.updated|deleted, invoice.payment_failed.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { errorResponse, AppError } from "@/lib/errors";

const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
]);

const TOLERANCE_SECONDS = 300;

/** Verify Stripe's `t=…,v1=…` signature header against the raw body. */
function verifyStripeSignature(rawBody: string, header: string, secret: string): boolean {
  const parts = new Map(
    header.split(",").map((kv) => kv.split("=", 2) as [string, string]),
  );
  const t = parts.get("t");
  const v1 = parts.get("v1");
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** In-memory idempotency ledger; stripe_events table in production (08 §6). */
const processedEvents = new Set<string>();

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    return errorResponse(
      new AppError("INTERNAL", "Stripe is not configured — set STRIPE_WEBHOOK_SECRET."),
    );
  }

  const rawBody = await request.text();
  if (!signature || !verifyStripeSignature(rawBody, signature, secret)) {
    return errorResponse(new AppError("FORBIDDEN", "Invalid Stripe signature."));
  }

  let event: { id?: string; type?: string };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return errorResponse(new AppError("VALIDATION", "Unparseable webhook body."));
  }

  if (!event.id || !event.type || !HANDLED_EVENTS.has(event.type)) {
    return Response.json({ received: true, ignored: true });
  }
  if (processedEvents.has(event.id)) {
    return Response.json({ received: true, duplicate: true });
  }
  processedEvents.add(event.id);

  // checkout.session.completed → set plan + stripe ids
  // customer.subscription.updated → map price→plan
  // customer.subscription.deleted → plan 'expired' at period end
  // invoice.payment_failed → flag + email
  // Plan mutations land with the Stripe setup script at M8 (docs/08 §6).
  return Response.json({ received: true });
}
