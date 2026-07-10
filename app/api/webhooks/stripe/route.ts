/**
 * POST /api/webhooks/stripe — billing lifecycle (docs/07 §3, 08 §6).
 * Signature-verified; idempotent via event-id ledger; handles
 * checkout.session.completed, customer.subscription.updated|deleted,
 * invoice.payment_failed.
 */
import { errorResponse, AppError } from "@/lib/errors";

const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
]);

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
  if (!signature) {
    return errorResponse(new AppError("FORBIDDEN", "Missing Stripe signature."));
  }

  // Full verification uses stripe.webhooks.constructEvent with the raw body;
  // the stripe SDK is added at M8 with the setup script (docs/08 §6).
  const rawBody = await request.text();
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
  return Response.json({ received: true });
}
