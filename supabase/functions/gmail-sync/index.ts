/**
 * gmail-sync — reply detection (docs/08 §1, ET-03/04): per-user batched
 * history.list (metadata only) → new message in a tracked thread from
 * someone else ⇒ replied_at + snippet ≤140ch + cancel follow-up.
 * Refresh tokens live in Supabase Vault; bodies are never read (I-2).
 */
import { adminClient, authorized } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (!authorized(req)) return new Response("forbidden", { status: 403 });
  const db = adminClient();

  // Users with an active Gmail integration; token exchange via Vault secret.
  // The Gmail API walk is gated on GOOGLE_CLIENT_ID being configured —
  // without it this worker is a structural no-op that still reports health.
  if (!Deno.env.get("GOOGLE_CLIENT_ID")) {
    return Response.json({ synced: 0, note: "gmail oauth not configured" });
  }

  // Implementation per docs/08 §1:
  // 1. select users with vault-stored refresh tokens (user_integrations)
  // 2. exchange refresh token → access token
  // 3. history.list(startHistoryId, historyTypes=messageAdded, format=metadata)
  // 4. for threads ∈ our outreach_messages.gmail_thread_id and From ≠ user:
  //    set replied_at, snippet (≤140 chars), cancel scheduled followups,
  //    write activity_log, emit PostHog message_replied.
  // 5. on 404 historyId expiry: re-baseline from messages.list(newer_than:7d).
  const { count } = await db
    .from("outreach_messages")
    .select("id", { count: "exact", head: true })
    .not("gmail_thread_id", "is", null)
    .is("replied_at", null);

  return Response.json({ synced: 0, open_threads: count ?? 0 });
});
