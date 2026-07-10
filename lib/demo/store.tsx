"use client";

/**
 * Workspace store — client state for every screen. Demo mode renders the
 * fixture corpus; when Supabase is configured and a session exists the
 * provider is hydrated with the caller's LiveBundle and every mutation
 * writes through to Supabase under RLS (docs/07 §2). The component tree is
 * identical in both modes.
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  accounts as seedAccounts,
  companies as seedCompanies,
  contacts as seedContacts,
  competitors as seedCompetitors,
  deliveries as seedDeliveries,
  messages as seedMessages,
  signals as seedSignals,
  suggestions as seedSuggestions,
  workspace as seedWorkspace,
  members as seedMembers,
  companyById,
} from "./data";
import type {
  Account,
  Company,
  Competitor,
  Contact,
  Delivery,
  DemoSignal,
  Member,
  Message,
  Stage,
  Suggestion,
  Workspace,
} from "./types";
import type { LiveBundle } from "@/lib/live/load";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeFit } from "@/lib/scoring/fit";
import { PLANS, type UsageMeters } from "@/lib/plans";

export interface FeedFiltersState {
  types: string[];
  stage: string | null;
  window: "today" | "7d" | "30d" | "all";
  view: "all" | "unclaimed" | "snoozed" | "archived";
}

interface DemoStore {
  live: boolean;
  userId: string | null;
  workspaceId: string | null;
  workspace: Workspace;
  members: Member[];
  companies: Company[];
  signals: DemoSignal[];
  competitors: Competitor[];
  accounts: Account[];
  deliveries: Delivery[];
  contacts: Contact[];
  messages: Message[];
  suggestions: Suggestion[];
  usage: UsageMeters;
  draftsUsed: number;
  claim: (deliveryId: string) => void;
  unclaim: (deliveryId: string) => void;
  markDone: (deliveryIds: string[]) => void;
  snooze: (deliveryId: string, days: number) => void;
  setStage: (accountId: string, stage: Stage) => void;
  addAccount: (companyId: string, company?: Company) => void;
  dismissSuggestion: (companyId: string) => void;
  recordSend: (accountId: string, contactId: string, subject: string, isSignalTriggered: boolean) => void;
  incrementDrafts: () => boolean;
  tagContact: (contactId: string, tag: string) => void;
}

const DemoContext = createContext<DemoStore | null>(null);

export function DemoProvider({
  children,
  initialData = null,
}: {
  children: React.ReactNode;
  initialData?: LiveBundle | null;
}) {
  const live = initialData !== null;
  const userId = initialData?.userId ?? null;
  const workspaceId = initialData?.workspaceId ?? null;
  const ws = initialData?.workspace ?? seedWorkspace;
  const members = initialData?.members ?? seedMembers;
  const [companies, setCompanies] = useState<Company[]>(initialData?.companies ?? seedCompanies);
  const [signals] = useState<DemoSignal[]>(initialData?.signals ?? seedSignals);
  const [competitors] = useState<Competitor[]>(initialData?.competitors ?? seedCompetitors);
  const [accounts, setAccounts] = useState<Account[]>(initialData?.accounts ?? seedAccounts);
  const [deliveries, setDeliveries] = useState<Delivery[]>(initialData?.deliveries ?? seedDeliveries);
  const [contacts, setContacts] = useState<Contact[]>(initialData?.contacts ?? seedContacts);
  const [messages, setMessages] = useState<Message[]>(initialData?.messages ?? seedMessages);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(live ? [] : seedSuggestions);
  const [draftsUsed, setDraftsUsed] = useState(live ? 0 : 38);

  // Write-through: optimistic local state first, best-effort Supabase second.
  const sync = useCallback(
    (fn: (db: SupabaseClient) => PromiseLike<unknown>) => {
      if (!live || !isSupabaseConfigured()) return;
      void Promise.resolve(fn(createClient())).catch(() => undefined);
    },
    [live],
  );

  const claim = useCallback((id: string) => {
    const at = new Date().toISOString();
    setDeliveries((ds) =>
      ds.map((d) =>
        d.id === id
          ? { ...d, status: "claimed" as const, claimed_by: userId ?? "u-amin", claimed_at: at }
          : d,
      ),
    );
    sync((db) =>
      db.from("signal_deliveries").update({ status: "claimed", claimed_by: userId, claimed_at: at }).eq("id", id),
    );
  }, [sync, userId]);

  const unclaim = useCallback((id: string) => {
    setDeliveries((ds) =>
      ds.map((d) =>
        d.id === id ? { ...d, status: "new" as const, claimed_by: null, claimed_at: null } : d,
      ),
    );
    sync((db) =>
      db.from("signal_deliveries").update({ status: "new", claimed_by: null, claimed_at: null }).eq("id", id),
    );
  }, [sync]);

  const markDone = useCallback((ids: string[]) => {
    setDeliveries((ds) =>
      ds.map((d) => (ids.includes(d.id) ? { ...d, status: "done" as const } : d)),
    );
    sync((db) =>
      db.from("signal_deliveries").update({ status: "done", done_at: new Date().toISOString() }).in("id", ids),
    );
  }, [sync]);

  const snooze = useCallback((id: string, days: number) => {
    const until = new Date(Date.now() + days * 86_400_000).toISOString();
    setDeliveries((ds) =>
      ds.map((d) => (d.id === id ? { ...d, status: "snoozed" as const, snoozed_until: until } : d)),
    );
    sync((db) =>
      db.from("signal_deliveries").update({ status: "snoozed", snoozed_until: until }).eq("id", id),
    );
  }, [sync]);

  const setStage = useCallback((accountId: string, stage: Stage) => {
    setAccounts((as) => as.map((a) => (a.id === accountId ? { ...a, stage, re_engage: false } : a)));
    sync((db) => db.from("accounts").update({ stage }).eq("id", accountId));
  }, [sync]);

  const addAccount = useCallback((companyId: string, companyArg?: Company) => {
    const company =
      companies.find((c) => c.id === companyId) ?? companyArg ?? companyById(companyId);
    if (!company) return;
    if (!companies.some((c) => c.id === companyId)) {
      setCompanies((cs) => [...cs, company]);
    }
    setAccounts((as) => {
      if (as.some((a) => a.company_id === companyId)) return as;
      const fit = computeFit(company, ws.icp);
      return [
        ...as,
        {
          id: `a-${companyId}`,
          company_id: companyId,
          status: "activating",
          fit_score: fit.score,
          fit_breakdown: fit.breakdown,
          urgency_score: 0,
          urgency_explain: null,
          stage: "identified",
          owner_id: null,
          created_at: new Date().toISOString(),
          last_outreach_at: null,
          re_engage: false,
        },
      ];
    });
    if (workspaceId) {
      const fit = computeFit(company, ws.icp);
      sync((db) =>
        db.from("accounts").upsert(
          { workspace_id: workspaceId, company_id: companyId, fit_score: fit.score, fit_breakdown: fit.breakdown },
          { onConflict: "workspace_id,company_id", ignoreDuplicates: true },
        ),
      );
    }
    // AD-03: Activating → Live ≤60s (demo: 3s)
    setTimeout(() => {
      setAccounts((as) =>
        as.map((a) => (a.company_id === companyId ? { ...a, status: "active" as const } : a)),
      );
    }, 3000);
  }, [companies, sync, workspaceId, ws.icp]);

  const dismissSuggestion = useCallback((companyId: string) => {
    setSuggestions((s) => s.filter((x) => x.company_id !== companyId));
  }, []);

  const recordSend = useCallback(
    (accountId: string, contactId: string, subject: string, isSignalTriggered: boolean) => {
      const at = new Date().toISOString();
      setMessages((ms) => [
        {
          id: `m-new-${Date.now()}`,
          account_id: accountId,
          contact_id: contactId,
          direction: "outbound",
          subject,
          snippet: "…",
          is_signal_triggered: isSignalTriggered,
          sent_at: at,
          opened_at: null,
          replied_at: null,
        },
        ...ms,
      ]);
      // PM-01 auto-advance: send moves identified → contacted
      setAccounts((as) =>
        as.map((a) =>
          a.id === accountId
            ? {
                ...a,
                stage: a.stage === "identified" ? ("contacted" as const) : a.stage,
                last_outreach_at: at,
                re_engage: false,
              }
            : a,
        ),
      );
      if (workspaceId && userId) {
        sync(async (db) => {
          await db.from("outreach_messages").insert({
            workspace_id: workspaceId,
            account_id: accountId,
            contact_id: contactId || null,
            sender_id: userId,
            subject,
            is_signal_triggered: isSignalTriggered,
            sent_at: at,
          });
          await db.from("accounts").update({ stage: "contacted" }).eq("id", accountId).eq("stage", "identified");
        });
      }
    },
    [sync, workspaceId, userId],
  );

  const incrementDrafts = useCallback((): boolean => {
    const limit = PLANS[ws.plan === "trial" ? "trial" : ws.plan].draftsPerMonth;
    let allowed = true;
    setDraftsUsed((n) => {
      if (n >= limit) {
        allowed = false;
        return n;
      }
      return n + 1;
    });
    return allowed;
  }, [ws.plan]);

  const tagContact = useCallback((contactId: string, tag: string) => {
    const target = contacts.find((c) => c.id === contactId);
    if (!target) return;
    const tags = target.tags.includes(tag)
      ? target.tags.filter((t) => t !== tag)
      : [...target.tags, tag];
    setContacts((cs) => cs.map((c) => (c.id === contactId ? { ...c, tags } : c)));
    sync((db) => db.from("contacts").update({ tags }).eq("id", contactId));
  }, [contacts, sync]);

  const usage: UsageMeters = useMemo(
    () => ({
      accounts: accounts.filter((a) => a.status !== "archived").length,
      contacts: contacts.length,
      seats: members.length,
      draftsThisMonth: draftsUsed,
    }),
    [accounts, contacts, members.length, draftsUsed],
  );

  const value = useMemo<DemoStore>(
    () => ({
      live,
      userId,
      workspaceId,
      workspace: ws,
      members,
      companies,
      signals,
      competitors,
      accounts,
      deliveries,
      contacts,
      messages,
      suggestions,
      usage,
      draftsUsed,
      claim,
      unclaim,
      markDone,
      snooze,
      setStage,
      addAccount,
      dismissSuggestion,
      recordSend,
      incrementDrafts,
      tagContact,
    }),
    [live, userId, workspaceId, ws, members, companies, signals, competitors, accounts, deliveries, contacts, messages, suggestions, usage, draftsUsed, claim, unclaim, markDone, snooze, setStage, addAccount, dismissSuggestion, recordSend, incrementDrafts, tagContact],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemoStore(): DemoStore {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemoStore must be used inside DemoProvider");
  return ctx;
}

export {
  companies,
  signals,
  sources,
  workspace,
  members,
  companyById,
  competitors,
} from "./data";
