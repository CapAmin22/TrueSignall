/**
 * Provider router — docs/06 §1.
 * callLLM: pick model by task → minute-bucket governor → call → fallback chain
 * → JSON parse + zod validate + 1 corrective retry → log.
 * Chains: quality → [gemini-2.5-flash, groq-llama-3.3-70b]
 *         cheap   → [gemini-2.5-flash-lite, gemini-2.5-flash, groq-llama-3.3-70b]
 * When no provider keys are configured (prototype demo mode), the deterministic
 * demo provider answers so every flow works offline.
 */
import { z } from "zod";
import { AIBusyError } from "@/lib/errors";
import { SYSTEM_PREAMBLE } from "@/lib/ai/prompts";
import { demoComplete } from "@/lib/ai/providers/demo";

export type TaskChain = "quality" | "cheap";
export type Priority = "interactive" | "background";

export interface LLMCall {
  task: string;
  prompt: string;
  chain?: TaskChain;
  priority?: Priority;
}

interface Provider {
  name: string;
  model: string;
  rpm: number;
  isConfigured: () => boolean;
  complete: (systemPrompt: string, userPrompt: string, model: string) => Promise<string>;
}

/** Per-provider minute token bucket — Gemini 15 RPM shared; Groq 30 RPM. */
class MinuteBucket {
  private timestamps: number[] = [];
  constructor(private limit: number) {}

  tryAcquire(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < 60_000);
    if (this.timestamps.length >= this.limit) return false;
    this.timestamps.push(now);
    return true;
  }
}

const buckets = new Map<string, MinuteBucket>();

function bucketFor(name: string, rpm: number): MinuteBucket {
  let b = buckets.get(name);
  if (!b) {
    b = new MinuteBucket(rpm);
    buckets.set(name, b);
  }
  return b;
}

async function geminiComplete(system: string, user: string, model: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function groqComplete(system: string, user: string, model: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`groq ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

const PROVIDERS: Record<string, Provider> = {
  "gemini-2.5-flash": {
    name: "gemini",
    model: "gemini-2.5-flash",
    rpm: 15,
    isConfigured: () => Boolean(process.env.GEMINI_API_KEY),
    complete: geminiComplete,
  },
  "gemini-2.5-flash-lite": {
    name: "gemini",
    model: "gemini-2.5-flash-lite",
    rpm: 15,
    isConfigured: () => Boolean(process.env.GEMINI_API_KEY),
    complete: geminiComplete,
  },
  "groq-llama-3.3-70b": {
    name: "groq",
    model: "llama-3.3-70b-versatile",
    rpm: 30,
    isConfigured: () => Boolean(process.env.GROQ_API_KEY),
    complete: groqComplete,
  },
};

const CHAINS: Record<TaskChain, string[]> = {
  quality: ["gemini-2.5-flash", "groq-llama-3.3-70b"],
  cheap: ["gemini-2.5-flash-lite", "gemini-2.5-flash", "groq-llama-3.3-70b"],
};

export function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

export async function callLLM({ task, prompt, chain = "quality" }: LLMCall): Promise<string> {
  const chainModels = CHAINS[chain].filter((m) => PROVIDERS[m].isConfigured());

  for (const modelKey of chainModels) {
    const provider = PROVIDERS[modelKey];
    // Gemini models share one quota pool — bucket keyed by provider name.
    if (!bucketFor(provider.name, provider.rpm).tryAcquire()) continue;
    const started = Date.now();
    try {
      const text = await provider.complete(SYSTEM_PREAMBLE, prompt, provider.model);
      logCall(task, modelKey, Date.now() - started, true);
      return text;
    } catch {
      logCall(task, modelKey, Date.now() - started, false);
    }
  }

  // No configured provider (or all failed): deterministic demo provider keeps
  // the prototype fully functional offline.
  const demo = demoComplete(task, prompt);
  if (demo !== null) return demo;

  throw new AIBusyError();
}

export async function callLLMJson<T>({
  task,
  prompt,
  chain,
  schema,
}: LLMCall & { schema: z.ZodType<T> }): Promise<T> {
  const raw = await callLLM({ task, prompt, chain });
  const first = tryParse(raw, schema);
  if (first.ok) return first.value;

  // One corrective retry — docs/06 §1 step 4.
  const corrected = await callLLM({
    task,
    prompt: `${prompt}\n\nYour previous output was not valid. Return ONLY valid JSON matching the specified shape.`,
    chain,
  });
  const second = tryParse(corrected, schema);
  if (second.ok) return second.value;
  throw new AIBusyError("AI returned an unexpected format — retry in 60s.");
}

function tryParse<T>(raw: string, schema: z.ZodType<T>): { ok: true; value: T } | { ok: false } {
  try {
    const parsed = JSON.parse(stripFences(raw));
    const result = schema.safeParse(parsed);
    if (result.success) return { ok: true, value: result.data };
  } catch {
    // fall through
  }
  return { ok: false };
}

interface AICallLog {
  task: string;
  model: string;
  ms: number;
  ok: boolean;
  at: string;
}

const recentCalls: AICallLog[] = [];

function logCall(task: string, model: string, ms: number, ok: boolean) {
  recentCalls.push({ task, model, ms, ok, at: new Date().toISOString() });
  if (recentCalls.length > 500) recentCalls.shift();
}

export function getRecentAICalls(): readonly AICallLog[] {
  return recentCalls;
}
