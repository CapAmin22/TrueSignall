/**
 * why-lines — fills signals.why_line via P-4, one call per GLOBAL signal,
 * cached forever (docs/06 §2 budget: the key free-tier survival cache).
 */
import { adminClient, authorized } from "../_shared/common.ts";

const P4_TEMPLATE = (type: string, title: string, payload: unknown, occurred: string) =>
  `TASK: Write the "why this matters now" line for a sales signal card. 1–2 sentences, ≤40 words total.
SIGNAL: type=${type} | title="${title}" | payload=${JSON.stringify(payload)} | occurred=${occurred}
ANCHOR STATS (use AT MOST one, only if the type matches): funding→"71% of funded companies finalize vendors within 90 days" ·
exec_change/new leader→"new executives spend 70% of their budget in the first 100 days" · champion_move→"a former champion is 5× warmer than a cold contact" ·
pricing_visit→"pricing-page visits signal late-stage evaluation" · hiring→"hiring for a role is the strongest proxy that tool evaluation is underway".
Sentence 1: what just happened and the concrete opening it creates. Sentence 2 (optional): the anchor stat, verbatim from the list.
No greetings, no "you should", no exclamation marks. Output plain text only.`;

async function callGemini(prompt: string): Promise<string | null> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return null;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
}

Deno.serve(async (req) => {
  if (!authorized(req)) return new Response("forbidden", { status: 403 });
  const db = adminClient();

  const { data: pending } = await db
    .from("signals")
    .select("id, type, title, payload, occurred_at")
    .is("why_line", null)
    .order("detected_at", { ascending: false })
    .limit(20); // batched — background priority (06 §1)

  let filled = 0;
  for (const signal of pending ?? []) {
    const line = await callGemini(
      P4_TEMPLATE(signal.type, signal.title, signal.payload, signal.occurred_at),
    );
    if (!line) break; // quota/outage: retry next tick, non-blocking (03 §6)
    await db.rpc("set_why_line", { sig: signal.id, line });
    filled++;
  }

  return Response.json({ filled, remaining: (pending?.length ?? 0) - filled });
});
