"use client";

/**
 * Demo store — client state for the prototype. In a configured deployment the
 * same operations run as Server Actions against Supabase with RLS (docs/07 §2);
 * the component tree is identical.
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  accounts as seedAccounts,
  companies,
  contacts as seedContacts,
  competitors as seedCompetitors,
  deliveries as seedDeliveries,
  messages as seedMessages,
  signals,
  sources,
  suggestions as seedSuggestions,
  workspace,
  members,
  companyById,
} from "./data";
import type { Account, Contact, Delivery, Message, Stage, Suggestion } from "./types";
import { computeFit } from "@/lib/scoring/fit";
import { PLANS, type UsageMeters } from "@/lib/plans";

export interface FeedFiltersState {
  types: string[];
  stage: string | null;
  window: "today" | "7d" | "30d" | "all";
  view: "all" | "unclaimed" | "snoozed" | "archived";
}

interface DemoStore {
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
  addAccount: (companyId: string) => void;
  dismissSuggestion: (companyId: string) => void;
  recordSend: (accountId: string, contactId: string, subject: string, isSignalTriggered: boolean) => void;
  incrementDrafts: () => boolean;
  tagContact: (contactId: string, tag: string) => void;
}

const DemoContext = createContext<DemoStore | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>(seedAccounts);
  const [deliveries, setDeliveries] = useState<Delivery[]>(seedDeliveries);
  const [contacts, setContacts] = useState<Contact[]>(seedContacts);
  const [messages, setMessages] = useState<Message[]>(seedMessages);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(seedSuggestions);
  const [draftsUsed, setDraftsUsed] = useState(38);

  const claim = useCallback((id: string) => {
    setDeliveries((ds) =>
      ds.map((d) =>
        d.id === id
          ? { ...d, status: "claimed" as const, claimed_by: "u-amin", claimed_at: new Date().toISOString() }
          : d,
      ),
    );
  }, []);

  const unclaim = useCallback((id: string) => {
    setDeliveries((ds) =>
      ds.map((d) =>
        d.id === id ? { ...d, status: "new" as const, claimed_by: null, claimed_at: null } : d,
      ),
    );
  }, []);

  const markDone = useCallback((ids: string[]) => {
    setDeliveries((ds) =>
      ds.map((d) => (ids.includes(d.id) ? { ...d, status: "done" as const } : d)),
    );
  }, []);

  const snooze = useCallback((id: string, days: number) => {
    const until = new Date(Date.now() + days * 86_400_000).toISOString();
    setDeliveries((ds) =>
      ds.map((d) => (d.id === id ? { ...d, status: "snoozed" as const, snoozed_until: until } : d)),
    );
  }, []);

  const setStage = useCallback((accountId: string, stage: Stage) => {
    setAccounts((as) => as.map((a) => (a.id === accountId ? { ...a, stage, re_engage: false } : a)));
  }, []);

  const addAccount = useCallback((companyId: string) => {
    const company = companyById(companyId);
    if (!company) return;
    setAccounts((as) => {
      if (as.some((a) => a.company_id === companyId)) return as;
      const fit = computeFit(company, workspace.icp);
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
    // AD-03: Activating → Live ≤60s (demo: 3s)
    setTimeout(() => {
      setAccounts((as) =>
        as.map((a) => (a.company_id === companyId ? { ...a, status: "active" as const } : a)),
      );
    }, 3000);
  }, []);

  const dismissSuggestion = useCallback((companyId: string) => {
    setSuggestions((s) => s.filter((x) => x.company_id !== companyId));
  }, []);

  const recordSend = useCallback(
    (accountId: string, contactId: string, subject: string, isSignalTriggered: boolean) => {
      setMessages((ms) => [
        {
          id: `m-new-${Date.now()}`,
          account_id: accountId,
          contact_id: contactId,
          direction: "outbound",
          subject,
          snippet: "…",
          is_signal_triggered: isSignalTriggered,
          sent_at: new Date().toISOString(),
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
                last_outreach_at: new Date().toISOString(),
                re_engage: false,
              }
            : a,
        ),
      );
    },
    [],
  );

  const incrementDrafts = useCallback((): boolean => {
    const limit = PLANS[workspace.plan === "trial" ? "trial" : workspace.plan].draftsPerMonth;
    let allowed = true;
    setDraftsUsed((n) => {
      if (n >= limit) {
        allowed = false;
        return n;
      }
      return n + 1;
    });
    return allowed;
  }, []);

  const tagContact = useCallback((contactId: string, tag: string) => {
    setContacts((cs) =>
      cs.map((c) =>
        c.id === contactId
          ? {
              ...c,
              tags: c.tags.includes(tag) ? c.tags.filter((t) => t !== tag) : [...c.tags, tag],
            }
          : c,
      ),
    );
  }, []);

  const usage: UsageMeters = useMemo(
    () => ({
      accounts: accounts.filter((a) => a.status !== "archived").length,
      contacts: contacts.length,
      seats: members.length,
      draftsThisMonth: draftsUsed,
    }),
    [accounts, contacts, draftsUsed],
  );

  const value = useMemo<DemoStore>(
    () => ({
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
    [accounts, deliveries, contacts, messages, suggestions, usage, draftsUsed, claim, unclaim, markDone, snooze, setStage, addAccount, dismissSuggestion, recordSend, incrementDrafts, tagContact],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemoStore(): DemoStore {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemoStore must be used inside DemoProvider");
  return ctx;
}

export { companies, signals, sources, workspace, members, companyById, seedCompetitors as competitors };
