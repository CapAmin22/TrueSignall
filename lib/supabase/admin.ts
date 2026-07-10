import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/** True when the service role is available (route handlers / server actions). */
export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY, // server only
  );
}

/**
 * Service-role client — bypasses RLS for global-corpus writes (signals,
 * companies, sources) and cross-tenant fanout. Never import from client code.
 */
export function createAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient is server only");
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // server only
    { auth: { persistSession: false } },
  );
}
