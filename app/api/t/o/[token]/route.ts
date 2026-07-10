/**
 * GET /api/t/o/[token].gif — open-tracking pixel (docs/07 §3).
 * Looks up outreach_messages.track_token → sets opened_at if null
 * (self-opens ignored via sender IP/UA heuristic) → transparent gif.
 */
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const trackToken = token.replace(/\.gif$/i, "");
  // Configured deployment: service-role update of opened_at keyed by
  // track_token. Prototype: no-op — the demo store simulates opens.
  void trackToken;

  return new Response(new Uint8Array(TRANSPARENT_GIF), {
    status: 200,
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
  });
}
