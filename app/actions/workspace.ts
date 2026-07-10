"use server";

/**
 * Workspace lifecycle server actions — onboarding persistence (docs/01 F1).
 * Demo mode (no Supabase): every action no-ops with { live: false } so the
 * wizard flows identically offline.
 */
import { z } from "zod";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isAdminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { normalizeDomain } from "@/lib/utils";

const onboardingSchema = z.object({
  domain: z.string().min(3).max(120),
  oneLiner: z.string().min(3).max(200),
  icp: z.record(z.string(), z.unknown()).default({}),
  importDomains: z.array(z.string().min(3).max(120)).max(500).default([]),
});

export interface OnboardingResult {
  live: boolean;
  workspaceId?: string;
  accountsCreated?: number;
  error?: string;
}

/**
 * Create the caller's workspace (owner membership), save the inferred ICP,
 * and import the CSV/pasted domains as companies + accounts.
 * Uses the service role after verifying the session — first-member insert
 * cannot pass member-RLS before the membership row exists.
 */
export async function completeOnboardingAction(
  raw: z.infer<typeof onboardingSchema>,
): Promise<OnboardingResult> {
  if (!isSupabaseConfigured() || !isAdminConfigured()) return { live: false };

  const input = onboardingSchema.parse(raw);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { live: true, error: "Not signed in." };

  const admin = createAdminClient();

  // Reuse an existing workspace if this user already owns one (re-run safe).
  const { data: existing } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  let workspaceId = existing?.workspace_id as string | undefined;
  if (!workspaceId) {
    const { data: ws, error: wsErr } = await admin
      .from("workspaces")
      .insert({
        name: input.domain.split(".")[0],
        domain: normalizeDomain(input.domain),
        product_one_liner: input.oneLiner,
        icp: input.icp,
      })
      .select("id")
      .single();
    if (wsErr || !ws) return { live: true, error: "Could not create workspace." };
    workspaceId = ws.id;
    await admin
      .from("workspace_members")
      .insert({ workspace_id: workspaceId, user_id: user.id, role: "owner" });
  } else {
    await admin
      .from("workspaces")
      .update({ product_one_liner: input.oneLiner, icp: input.icp })
      .eq("id", workspaceId);
  }

  const accountsCreated = await importAccounts(admin, workspaceId!, input.importDomains);
  return { live: true, workspaceId, accountsCreated };
}

async function importAccounts(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  domains: string[],
): Promise<number> {
  const clean = [...new Set(domains.map(normalizeDomain).filter((d) => d.includes(".")))];
  if (!clean.length) return 0;

  await admin.from("companies").upsert(
    clean.map((domain) => ({ domain, name: domain.split(".")[0], source: "user_import" })),
    { onConflict: "domain", ignoreDuplicates: true },
  );
  const { data: companies } = await admin
    .from("companies")
    .select("id")
    .in("domain", clean);
  if (!companies?.length) return 0;

  const { error } = await admin.from("accounts").upsert(
    companies.map((c) => ({
      workspace_id: workspaceId,
      company_id: c.id,
      fit_score: 50, // recomputed on enrichment (docs/05 §6)
      source: "import",
    })),
    { onConflict: "workspace_id,company_id", ignoreDuplicates: true },
  );
  return error ? 0 : companies.length;
}
