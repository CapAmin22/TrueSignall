"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Zap } from "lucide-react";
import { copy } from "@/lib/copy";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";

type Provider = "google" | "linkedin_oidc";

export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (provider: Provider) => {
    // Demo mode: no Supabase configured — walk straight into the product.
    if (!isSupabaseConfigured()) {
      router.push("/onboarding");
      return;
    }
    setBusy(provider);
    setError(null);
    const next = new URLSearchParams(window.location.search).get("next") ?? "";
    const redirectTo = `${window.location.origin}/auth/callback${
      next.startsWith("/") && !next.startsWith("//") ? `?next=${encodeURIComponent(next)}` : ""
    }`;
    const { error: err } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (err) {
      setBusy(null);
      setError(err.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm p-6 text-center">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary text-white">
          <Zap size={19} />
        </span>
        <h1 className="mt-3 text-lg font-semibold text-text">Sign in to {copy.appName}</h1>
        <p className="mt-1 text-sm text-muted">OAuth only — no passwords to manage.</p>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            variant="primary"
            size="lg"
            className="w-full justify-center"
            disabled={busy !== null}
            onClick={() => signIn("google")}
          >
            {busy === "google" ? "Redirecting…" : "Continue with Google"}
          </Button>
          <Button
            size="lg"
            className="w-full justify-center"
            disabled={busy !== null}
            onClick={() => signIn("linkedin_oidc")}
          >
            {busy === "linkedin_oidc" ? "Redirecting…" : "Continue with LinkedIn"}
          </Button>
        </div>
        {error && <p className="mt-3 text-xs text-hot">{error}</p>}
        {!isSupabaseConfigured() && (
          <p className="mt-4 text-xs text-muted">
            Prototype demo mode — Supabase Auth (Google/LinkedIn) activates once
            NEXT_PUBLIC_SUPABASE_URL is configured.
          </p>
        )}
      </Card>
    </div>
  );
}
