/**
 * followup-scan — ET-02: due follow-ups become surfaced cards; the app
 * drafts a variation referencing any NEW signal since the original send.
 */
import { adminClient, authorized } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (!authorized(req)) return new Response("forbidden", { status: 403 });
  const db = adminClient();

  const { data: due } = await db
    .from("followups")
    .select("id, message_id, workspace_id")
    .eq("status", "scheduled")
    .lte("due_at", new Date().toISOString())
    .limit(100);

  let surfaced = 0;
  for (const followup of due ?? []) {
    // Skip if the original thread got a reply (gmail-sync sets replied_at).
    const { data: message } = await db
      .from("outreach_messages")
      .select("replied_at, account_id")
      .eq("id", followup.message_id)
      .single();
    if (message?.replied_at) {
      await db.from("followups").update({ status: "cancelled" }).eq("id", followup.id);
      continue;
    }
    await db.from("followups").update({ status: "surfaced" }).eq("id", followup.id);
    await db.from("activity_log").insert({
      workspace_id: followup.workspace_id,
      account_id: message?.account_id ?? null,
      verb: "followup_due",
      meta: { followup_id: followup.id },
    });
    surfaced++;
  }

  return Response.json({ surfaced });
});
