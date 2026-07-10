"use server";

/**
 * AI server actions — mutations per docs/07 §2. Zod-validate → work → typed
 * result. All LLM traffic goes through lib/ai/router.ts (docs/06 §1).
 */
import { z } from "zod";
import { callLLM, callLLMJson, stripFences } from "@/lib/ai/router";
import {
  P1_ICP_INFERENCE,
  P2_NL_FILTERS,
  P5_OUTREACH_DRAFT,
  P5B_SECTION_REGEN,
  P7_PRECALL_BRIEF,
  P8_PERSONAL_NOTE,
  fillTemplate,
} from "@/lib/ai/prompts";
import {
  draftSectionsSchema,
  validateDraft,
  computeQuality,
  buildTriggerKeywords,
  type DraftSections,
  type QualityScore,
  type ValidationResult,
} from "@/lib/ai/validate";

const icpSchema = z.object({
  industries: z.array(z.string()).max(4),
  company_sizes: z.array(z.string()),
  stages: z.array(z.string()),
  seniorities: z.array(z.string()).max(3),
  geos: z.array(z.string()).max(3),
  pain_points: z.array(z.string()).min(1).max(5),
  buyer_titles: z.array(z.string()).max(5),
  confidence: z.enum(["high", "medium", "low"]),
});

export type InferredICP = z.infer<typeof icpSchema>;

export async function inferICPAction(domain: string, oneLiner: string): Promise<InferredICP> {
  const input = z
    .object({ domain: z.string().min(3), oneLiner: z.string().min(3).max(200) })
    .parse({ domain, oneLiner });

  const prompt = fillTemplate(P1_ICP_INFERENCE, {
    domain: input.domain,
    one_liner: input.oneLiner,
    homepage_text: "(homepage fetch not configured in prototype)",
  });
  return callLLMJson({ task: "icp_inference", prompt, chain: "quality", schema: icpSchema });
}

const filtersSchema = z.object({
  industries: z.array(z.string()).nullable(),
  company_sizes: z.array(z.string()).nullable(),
  stages: z.array(z.string()).nullable(),
  geos: z.array(z.string()).nullable(),
  tech: z.array(z.string()).nullable(),
  keywords: z.array(z.string()).nullable(),
  semantic_query: z.string(),
});

export type DiscoverFilters = z.infer<typeof filtersSchema>;

export async function nlSearchAction(query: string): Promise<DiscoverFilters> {
  const q = z.string().min(2).max(300).parse(query);
  const prompt = fillTemplate(P2_NL_FILTERS, { query: q });
  return callLLMJson({ task: "nl_filters", prompt, chain: "cheap", schema: filtersSchema });
}

const draftContextSchema = z.object({
  founderName: z.string(),
  wsName: z.string(),
  oneLiner: z.string(),
  contactName: z.string(),
  contactTitle: z.string(),
  companyName: z.string(),
  stage: z.enum(["cold", "warm", "re_engage"]),
  priorTouches: z.string(),
  triggers: z.array(
    z.object({
      type: z.string(),
      title: z.string(),
      whyLine: z.string(),
      occurred: z.string(),
      sourceUrl: z.string().nullable(),
      payload: z.record(z.string(), z.unknown()).default({}),
    }),
  ),
  painPoints: z.array(z.string()),
  voiceFeatures: z.string().default("{}"),
  exemplars: z.array(z.string()).default([]),
});

export type DraftContext = z.infer<typeof draftContextSchema>;

export interface GeneratedDraft {
  sections: DraftSections;
  validation: ValidationResult;
  quality: QualityScore;
}

function buildDraftPrompt(ctx: DraftContext): string {
  return fillTemplate(P5_OUTREACH_DRAFT, {
    founder_name: ctx.founderName,
    ws_name: `${ctx.wsName} `,
    one_liner: ctx.oneLiner,
    "features json": ctx.voiceFeatures,
    "≤5 snippets": ctx.exemplars.join(" | ") || "none",
    name: ctx.contactName,
    title: ctx.contactTitle,
    company: `${ctx.companyName} `,
    "cold|warm|re_engage": ctx.stage,
    'count, last subject/date or "none"': ctx.priorTouches,
    "for each: type, title, why_line, occurred, source_url": ctx.triggers
      .map(
        (t) =>
          `type=${t.type}, title="${t.title}", why_line="${t.whyLine}", occurred=${t.occurred}, source_url=${t.sourceUrl ?? "n/a"}`,
      )
      .join(" ;; "),
    list: ctx.painPoints.join(", "),
  });
}

async function finishDraft(ctx: DraftContext, sections: DraftSections): Promise<GeneratedDraft> {
  const trigger = ctx.triggers[0];
  const keywords = buildTriggerKeywords(
    trigger.type,
    trigger.title,
    trigger.payload as Record<string, unknown>,
  );
  let validation = validateDraft(sections, keywords);

  // One silent corrective regen if the opening misses the trigger (docs/06 §5).
  if (!validation.signalRefPassed) {
    const corrective = `${buildDraftPrompt(ctx)}\n\nYour opening did not reference ${trigger.title}. Rewrite opening only.`;
    try {
      const raw = await callLLM({ task: "outreach_draft", prompt: corrective, chain: "quality" });
      const reparsed = draftSectionsSchema.safeParse(JSON.parse(stripFences(raw)));
      if (reparsed.success) {
        sections = reparsed.data;
        validation = validateDraft(sections, keywords);
      }
    } catch {
      // keep original draft; amber flag renders in the composer
    }
  }

  const quality = computeQuality(sections, validation, {
    contactName: ctx.contactName,
    contactTitle: ctx.contactTitle,
    painPoints: ctx.painPoints,
    voicePhrases: [],
  });

  return { sections, validation, quality };
}

export async function generateDraftAction(rawCtx: DraftContext): Promise<GeneratedDraft> {
  const ctx = draftContextSchema.parse(rawCtx);
  const sections = await callLLMJson({
    task: "outreach_draft",
    prompt: buildDraftPrompt(ctx),
    chain: "quality",
    schema: draftSectionsSchema,
  });
  return finishDraft(ctx, sections);
}

export async function regenerateSectionAction(
  rawCtx: DraftContext,
  current: DraftSections,
  section: keyof DraftSections,
): Promise<GeneratedDraft> {
  const ctx = draftContextSchema.parse(rawCtx);
  const prompt = `${buildDraftPrompt(ctx)}\n\nCURRENT DRAFT: ${JSON.stringify(current)}\n${fillTemplate(
    P5B_SECTION_REGEN,
    { section },
  )}`;
  const sections = await callLLMJson({
    task: "section_regen",
    prompt,
    chain: "quality",
    schema: draftSectionsSchema,
  });
  return finishDraft(ctx, sections);
}

const briefSchema = z.object({
  why_this_conversation: z.string(),
  company_now: z.string(),
  people: z.array(
    z.object({
      name: z.string(),
      title: z.string(),
      one_relevant_fact_or_null: z.string().nullable().optional(),
    }),
  ),
  talking_points: z.array(z.string()),
  landmines: z.array(z.string()),
  history: z.string(),
});

export type Brief = z.infer<typeof briefSchema>;

export interface BriefContext {
  companyFacts: string;
  signals: string;
  contacts: string;
  history: string;
  oneLiner: string;
  pains: string[];
  competitors: string;
}

const personalNoteSchema = z.object({
  note: z.string().min(10).max(600),
  channel_hint: z.enum(["text", "email", "linkedin_dm"]),
});

export type PersonalNote = z.infer<typeof personalNoteSchema>;

const personalNoteCtxSchema = z.object({
  founderName: z.string(),
  connectionName: z.string(),
  connectionTitle: z.string().default(""),
  band: z.string(),
  context: z.string().default(""),
  momentType: z.string(),
  momentTitle: z.string(),
  momentDetail: z.string().default(""),
  occurred: z.string(),
});

export type PersonalNoteContext = z.infer<typeof personalNoteCtxSchema>;

/** P-8 — congratulate, never pitch. The relationship layer's note generator. */
export async function generatePersonalNoteAction(
  rawCtx: PersonalNoteContext,
): Promise<PersonalNote> {
  const ctx = personalNoteCtxSchema.parse(rawCtx);
  const prompt = fillTemplate(P8_PERSONAL_NOTE, {
    founder_name: ctx.founderName,
    name: ctx.connectionName,
    title_or_blank: ctx.connectionTitle,
    band: ctx.band,
    context: ctx.context,
    type: ctx.momentType,
    title: ctx.momentTitle,
    detail: ctx.momentDetail,
    relative_time: ctx.occurred,
  });
  return callLLMJson({ task: "personal_note", prompt, chain: "quality", schema: personalNoteSchema });
}

export async function generateBriefAction(ctx: BriefContext): Promise<Brief> {
  const prompt = fillTemplate(P7_PRECALL_BRIEF, {
    "company facts": ctx.companyFacts,
    "list w/ dates+urls": ctx.signals,
    "known people w/ titles, tags": ctx.contacts,
    "sent/replied summary": ctx.history,
    one_liner: ctx.oneLiner,
    list: ctx.pains.join(", "),
    "list|none": ctx.competitors || "none",
  });
  return callLLMJson({ task: "brief", prompt, chain: "quality", schema: briefSchema });
}
