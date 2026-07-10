/** App-level entity shapes mirroring docs/04 tables (subset the UI renders). */
import type { SignalType, SignalPayload } from "@/lib/signals/taxonomy";
import type { FitDimension } from "@/lib/scoring/fit";
import type { UrgencyExplain } from "@/lib/scoring/urgency";
import type { ICP } from "@/lib/scoring/fit";

export type Stage =
  | "identified"
  | "contacted"
  | "responded"
  | "meeting_booked"
  | "proposal_sent"
  | "closed_won"
  | "closed_lost";

export interface Company {
  id: string;
  domain: string;
  name: string;
  description: string;
  industry: string;
  employee_range: string;
  stage: string;
  hq_country: string;
  tech_stack: string[];
  source: string;
}

export interface Account {
  id: string;
  company_id: string;
  status: "activating" | "active" | "archived";
  fit_score: number;
  fit_breakdown: FitDimension[];
  urgency_score: number;
  urgency_explain: UrgencyExplain | null;
  stage: Stage;
  owner_id: string | null;
  created_at: string;
  last_outreach_at: string | null;
  re_engage: boolean;
}

export interface Contact {
  id: string;
  account_id: string;
  full_name: string;
  title: string;
  email: string;
  seniority: "c_suite" | "vp" | "director" | "manager" | "ic" | "unknown";
  tags: string[];
}

export interface DemoSignal {
  id: string;
  company_id: string;
  type: SignalType;
  title: string;
  payload: SignalPayload;
  source: string;
  source_url: string | null;
  occurred_at: string;
  detected_at: string;
  why_line: string | null;
}

export type DeliveryStatus = "new" | "claimed" | "done" | "snoozed";

export interface Delivery {
  id: string;
  account_id: string;
  signal_id: string;
  urgency: number;
  stack_group_id: string | null;
  status: DeliveryStatus;
  claimed_by: string | null;
  claimed_at: string | null;
  snoozed_until: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  account_id: string;
  contact_id: string;
  direction: "outbound" | "inbound" | "call_note";
  subject: string;
  snippet: string;
  is_signal_triggered: boolean;
  sent_at: string;
  opened_at: string | null;
  replied_at: string | null;
}

export interface Competitor {
  id: string;
  name: string;
  domain: string;
  funding: string;
  headcount: string;
  g2_rating: number;
  latest_news: string;
}

export interface SourceHealth {
  key: string;
  kind: "rss" | "api" | "crawl" | "webhook" | "user";
  cadence_minutes: number;
  enabled: boolean;
  last_success_minutes_ago: number;
  consecutive_failures: number;
  signals_today: number;
}

export interface Member {
  id: string;
  full_name: string;
  email: string;
  role: "owner" | "member";
}

export interface Suggestion {
  company_id: string;
  reason: string;
}

export interface Workspace {
  name: string;
  domain: string;
  one_liner: string;
  icp: ICP;
  plan: "trial" | "starter" | "growth" | "scale";
  trial_days_left: number;
  founder_name: string;
  pricing_paths: string[];
}
