import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";

/** OAuth callback — exchanges the code for a session (docs/02 §3 route map). */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (code && isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL("/onboarding", url.origin));
}
