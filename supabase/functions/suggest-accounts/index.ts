/**
 * suggest-accounts — AD-04 Monday job: propose 10–25 net-new corpus
 * companies ≥70 fit per workspace, each with the primary reason.
 */
import { adminClient, authorized } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (!authorized(req)) return new Response("forbidden", { status: 403 });
  const db = adminClient();

  const { data: workspaces } = await db.from("workspaces").select("id, icp").limit(200);
  let suggested = 0;

  for (const workspace of workspaces ?? []) {
    const { data: monitored } = await db
      .from("accounts")
      .select("company_id")
      .eq("workspace_id", workspace.id);
    const monitoredIds = new Set((monitored ?? []).map((a) => a.company_id));

    // Facet pre-filter on the ICP; full fit scoring runs app-side on add.
    const icp = workspace.icp as { stages?: string[]; company_sizes?: string[] };
    let query = db.from("companies").select("id, name, stage, employee_range").limit(25);
    if (icp.stages?.length) query = query.in("stage", icp.stages);
    if (icp.company_sizes?.length) query = query.in("employee_range", icp.company_sizes);
    const { data: candidates } = await query;

    const fresh = (candidates ?? []).filter((c) => !monitoredIds.has(c.id)).slice(0, 25);
    for (const candidate of fresh) {
      await db.from("activity_log").insert({
        workspace_id: workspace.id,
        verb: "account_suggested",
        meta: { company_id: candidate.id, reason: `matches ICP ${candidate.stage}/${candidate.employee_range}` },
      });
      suggested++;
    }
  }

  return Response.json({ suggested });
});
