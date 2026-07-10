"use server";

/**
 * Discover corpus search — Supabase-backed facet query over the global
 * companies table (docs/01 F3). Demo mode returns [] and the page falls back
 * to the fixture corpus. Semantic (pgvector) ranking lands with embeddings;
 * facets + keyword ilike cover the launch behavior.
 */
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { DiscoverFilters } from "@/app/actions/ai";
import type { Company } from "@/lib/demo/types";

export async function searchCorpusAction(filters: DiscoverFilters): Promise<Company[]> {
  if (!isSupabaseConfigured()) return [];
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return [];

  let q = db.from("companies").select("*").limit(50);
  if (filters.stages?.length) q = q.in("stage", filters.stages);
  if (filters.company_sizes?.length) q = q.in("employee_range", filters.company_sizes);
  if (filters.geos?.length) q = q.in("hq_country", filters.geos.map((g) => g.toUpperCase()));
  if (filters.industries?.length) {
    q = q.or(filters.industries.map((i) => `industry.ilike.%${escapeLike(i)}%`).join(","));
  }
  const keyword = filters.keywords?.[0] ?? null;
  if (keyword) {
    const k = escapeLike(keyword);
    q = q.or(`name.ilike.%${k}%,description.ilike.%${k}%`);
  }

  const { data } = await q;
  return (data ?? []).map((row) => ({
    id: row.id,
    domain: row.domain,
    name: row.name ?? row.domain,
    description: row.description ?? "",
    industry: row.industry ?? "unknown",
    employee_range: row.employee_range ?? "11-50",
    stage: row.stage ?? "unknown",
    hq_country: row.hq_country ?? "—",
    tech_stack: row.tech_stack ?? [],
    source: row.source ?? "corpus",
  }));
}

function escapeLike(value: string): string {
  return value.replace(/[%_,()]/g, "");
}
