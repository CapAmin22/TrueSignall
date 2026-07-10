import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";

/**
 * OAuth callback — exchanges the code for a session (docs/02 §3 route map).
 * New users (no workspace yet) land on onboarding; returning users on /feed.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "";
  // Relative paths only — never redirect off-origin.
  const safeNext =
    nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;

  if (!code || !isSupabaseConfigured()) {
    return NextResponse.redirect(new URL(safeNext ?? "/onboarding", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const dest = safeNext ?? (membership ? "/feed" : "/onboarding");
  return NextResponse.redirect(new URL(dest, url.origin));
}
