"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import { copy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm p-6 text-center">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary text-white">
          <Zap size={19} />
        </span>
        <h1 className="mt-3 text-lg font-semibold text-text">Sign in to {copy.appName}</h1>
        <p className="mt-1 text-sm text-muted">OAuth only — no passwords to manage.</p>
        <div className="mt-5 flex flex-col gap-2">
          <Link href="/onboarding">
            <Button variant="primary" size="lg" className="w-full justify-center">
              Continue with Google
            </Button>
          </Link>
          <Link href="/onboarding">
            <Button size="lg" className="w-full justify-center">
              Continue with LinkedIn
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted">
          Prototype demo mode — Supabase Auth (Google/LinkedIn) activates once
          NEXT_PUBLIC_SUPABASE_URL is configured.
        </p>
      </Card>
    </div>
  );
}
