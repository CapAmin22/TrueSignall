/**
 * Relationship-intelligence entities — the personal-network layer that is the
 * product's USP: the founder's own contacts, the personal moments worth a
 * human note, and warm-intro paths into target accounts.
 *
 * Privacy: ALL of this is workspace-scoped personal data. It never enters
 * global tables and is never used to train anything (invariant I-1).
 */

export type ConnectionSource =
  | "gmail_import"
  | "phone_import"
  | "linkedin_export"
  | "csv_import"
  | "manual";

export type WarmthBand = "hot" | "warm" | "cooling" | "cold";

export interface Connection {
  id: string;
  full_name: string;
  emails: string[];
  phones: string[];
  company_domain: string | null;
  company_name: string | null;
  title: string | null;
  linkedin_url: string | null;
  source: ConnectionSource;
  /** Relationship closeness the founder sets or imports (0–100). */
  closeness: number;
  last_interaction_at: string | null;
  interaction_count: number;
  birthday: string | null; // ISO date; year may be 1900 when unknown
  tags: string[]; // 'decision_maker' | 'investor' | 'friend' | 'ex_colleague' | …
  notes: string;
  created_at: string;
}

/** Personal moments — distinct taxonomy from the 14 company signal types. */
export const PERSONAL_SIGNAL_TYPES = [
  "birthday",
  "job_change",
  "promotion",
  "work_anniversary",
  "new_baby",
  "new_home",
  "wedding",
  "award",
  "speaking",
  "published",
  "company_milestone",
  "education",
] as const;

export type PersonalSignalType = (typeof PERSONAL_SIGNAL_TYPES)[number];

export type MomentStatus = "new" | "acted" | "dismissed";

export interface PersonalSignal {
  id: string;
  connection_id: string;
  type: PersonalSignalType;
  title: string;
  detail: string;
  source: string; // 'linkedin_clip' | 'news' | 'birthday_calendar' | 'manual'
  source_url: string | null;
  occurred_at: string;
  status: MomentStatus;
}

export interface WarmthResult {
  score: number; // 0–100
  band: WarmthBand;
  /** Days until this connection is due a touch (negative = overdue). */
  reconnectDueInDays: number;
}

export interface IntroPath {
  connection: Connection;
  companyDomain: string;
  strength: number; // 0–100
  reason: string;
}
