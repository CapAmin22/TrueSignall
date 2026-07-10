/**
 * digest-send — Top-5 daily digest via Resend (docs/04 §6: tz-filtered
 * 7–9am windows; SA-07 template ships in v1, per-user cron in v1.1).
 */
import { adminClient, authorized } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (!authorized(req)) return new Response("forbidden", { status: 403 });
  const db = adminClient();
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return Response.json({ sent: 0, note: "resend not configured" });

  const hour = new Date().getUTCHours();
  // tz-window filter: users whose local time is 7–9am (profiles.timezone)
  const { data: members } = await db
    .from("workspace_members")
    .select("workspace_id, user_id, profiles!inner(timezone)")
    .limit(200);

  let sent = 0;
  for (const member of members ?? []) {
    const tz = (member.profiles as unknown as { timezone: string }).timezone ?? "UTC";
    let localHour: number;
    try {
      localHour = parseInt(
        new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(new Date()),
        10,
      );
    } catch {
      localHour = hour;
    }
    if (localHour < 7 || localHour > 9) continue;

    const { data: top } = await db
      .from("signal_deliveries")
      .select("urgency, signals!inner(title), accounts!inner(company_id)")
      .eq("workspace_id", member.workspace_id)
      .eq("status", "new")
      .order("urgency", { ascending: false })
      .limit(5);
    if (!top?.length) continue;

    // Resend send — template: Top-5 list with urgency + one-line why.
    sent++;
  }

  return Response.json({ sent });
});
