import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
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
  Workspace,
} from "@/lib/demo/types";
import type { ICP } from "@/lib/scoring/fit";
import type { SignalType, SignalPayload } from "@/lib/signals/taxonomy";

/**
 * Live workspace bundle — the Supabase-backed equivalent of the demo
 * fixtures, loaded server-side with the caller's RLS-scoped session and
 * hydrated into the same store the screens already render (docs/07 §2).
 */
export interface LiveBundle {
  userId: string;
  workspaceId: string;
  workspace: Workspace;
  members: Member[];
  companies: Company[];
  signals: DemoSignal[];
  accounts: Account[];
  deliveries: Delivery[];
  contacts: Contact[];
  messages: Message[];
  competitors: Competitor[];
}

const EMPTY_ICP: ICP = { industries: [], company_sizes: [], stages: [], geos: [] };

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function mapCompany(row: Row): Company {
  return {
    id: row.id,
    domain: row.domain,
    name: row.name ?? row.domain,
    description: row.description ?? "",
    industry: row.industry ?? "unknown",
    employee_range: row.employee_range ?? "11-50",
    stage: row.stage ?? "unknown",
    hq_country: row.hq_country ?? "—",
    tech_stack: row.tech_stack ?? [],
    source: row.source ?? "import",
  };
}

function mapAccount(row: Row, lastOutreach: Map<string, string>): Account {
  return {
    id: row.id,
    company_id: row.company_id,
    status: row.status,
    fit_score: row.fit_score ?? 50,
    fit_breakdown: row.fit_breakdown ?? [],
    urgency_score: row.urgency_score ?? 0,
    urgency_explain: null,
    stage: row.stage as Stage,
    owner_id: row.owner_id,
    created_at: row.created_at,
    last_outreach_at: lastOutreach.get(row.id) ?? null,
    re_engage: false,
  };
}

function mapSignal(row: Row): DemoSignal {
  return {
    id: row.id,
    company_id: row.company_id,
    type: row.type as SignalType,
    title: row.title,
    payload: (row.payload ?? {}) as SignalPayload,
    source: row.source,
    source_url: row.source_url,
    occurred_at: row.occurred_at,
    detected_at: row.detected_at,
    why_line: row.why_line,
  };
}

function mapWorkspace(row: Row, founderName: string): Workspace {
  const days = Math.max(
    0,
    Math.ceil((new Date(row.trial_ends_at).getTime() - Date.now()) / 86_400_000),
  );
  const plan = ["starter", "growth", "scale"].includes(row.plan) ? row.plan : "trial";
  return {
    name: row.name,
    domain: row.domain ?? "",
    one_liner: row.product_one_liner ?? "",
    icp: { ...EMPTY_ICP, ...(row.icp ?? {}) },
    plan,
    trial_days_left: days,
    founder_name: founderName,
    pricing_paths: row.pricing_paths ?? ["/pricing"],
  };
}

async function fetchBundle(db: SupabaseClient, userId: string, ws: Row): Promise<LiveBundle> {
  const wsId = ws.id as string;
  const [accountsQ, deliveriesQ, contactsQ, messagesQ, competitorsQ, membersQ, profileQ] =
    await Promise.all([
      db.from("accounts").select("*, companies(*)").eq("workspace_id", wsId).limit(500),
      db
        .from("signal_deliveries")
        .select("*, signals(*)")
        .eq("workspace_id", wsId)
        .order("urgency", { ascending: false })
        .limit(300),
      db.from("contacts").select("*").eq("workspace_id", wsId).limit(500),
      db
        .from("outreach_messages")
        .select("*")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: false })
        .limit(500),
      db.from("competitors").select("*").eq("workspace_id", wsId),
      db.from("workspace_members").select("user_id, role").eq("workspace_id", wsId),
      db.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    ]);

  const companies = new Map<string, Company>();
  const accountsRaw = accountsQ.data ?? [];
  for (const a of accountsRaw) if (a.companies) companies.set(a.companies.id, mapCompany(a.companies));

  const signals = new Map<string, DemoSignal>();
  const deliveries: Delivery[] = [];
  for (const d of deliveriesQ.data ?? []) {
    if (d.signals) signals.set(d.signals.id, mapSignal(d.signals));
    deliveries.push({
      id: d.id,
      account_id: d.account_id,
      signal_id: d.signal_id,
      urgency: d.urgency ?? 0,
      stack_group_id: d.stack_group_id,
      status: d.status,
      claimed_by: d.claimed_by,
      claimed_at: d.claimed_at,
      snoozed_until: d.snoozed_until,
      created_at: d.created_at,
    });
  }

  const messages: Message[] = (messagesQ.data ?? []).map((m: Row) => ({
    id: m.id,
    account_id: m.account_id,
    contact_id: m.contact_id ?? "",
    direction: m.direction,
    subject: m.subject ?? "",
    snippet: m.snippet ?? "",
    is_signal_triggered: m.is_signal_triggered ?? true,
    sent_at: m.sent_at ?? m.created_at,
    opened_at: m.opened_at,
    replied_at: m.replied_at,
  }));

  const lastOutreach = new Map<string, string>();
  for (const m of messages) {
    if (m.direction === "outbound" && !lastOutreach.has(m.account_id)) {
      lastOutreach.set(m.account_id, m.sent_at);
    }
  }

  const founder = profileQ.data?.full_name ?? "Founder";
  return {
    userId,
    workspaceId: wsId,
    workspace: mapWorkspace(ws, founder),
    members: (membersQ.data ?? []).map((m: Row) => ({
      id: m.user_id,
      full_name: m.user_id === userId ? founder : "Teammate",
      email: "",
      role: m.role,
    })),
    companies: [...companies.values()],
    signals: [...signals.values()],
    accounts: accountsRaw.map((a: Row) => mapAccount(a, lastOutreach)),
    deliveries,
    contacts: (contactsQ.data ?? []).map((c: Row) => ({
      id: c.id,
      account_id: c.account_id ?? "",
      full_name: c.full_name,
      title: c.title ?? "",
      email: c.email ?? "",
      seniority: c.seniority ?? "unknown",
      tags: c.tags ?? [],
    })),
    messages,
    competitors: (competitorsQ.data ?? []).map((c: Row) => ({
      id: c.id,
      name: c.name,
      domain: c.domain,
      funding: c.enrichment?.funding ?? "—",
      headcount: c.enrichment?.headcount ?? "—",
      g2_rating: c.enrichment?.g2_rating ?? 0,
      latest_news: c.enrichment?.latest_news ?? "",
    })),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Load the caller's workspace from Supabase, or null when the app should run
 * on demo fixtures (no env, no session, or no workspace yet).
 */
export async function loadLiveBundle(): Promise<LiveBundle | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const db = await createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return null;

    const { data: membership } = await db
      .from("workspace_members")
      .select("workspace_id, workspaces(*)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!membership?.workspaces) return null;

    return await fetchBundle(db, user.id, membership.workspaces as Row);
  } catch {
    return null; // fail open into demo mode rather than blanking the app
  }
}
