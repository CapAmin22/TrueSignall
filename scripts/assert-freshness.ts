/**
 * Freshness assertion — docs/11 §4 crawler health step.
 * Reads /api/cron/health JSON from stdin; exits 1 if any enabled source is
 * stale (last success > 4× cadence) or auto-disabled.
 */
interface HealthSource {
  key: string;
  enabled: boolean;
  cadence_minutes: number;
  last_success_minutes_ago: number;
  consecutive_failures: number;
  stale: boolean;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const input = await readStdin();
  const health: { sources: HealthSource[] } = JSON.parse(input);

  const problems = health.sources.filter(
    (s) => (s.enabled && s.stale) || s.consecutive_failures >= 5,
  );

  for (const source of health.sources) {
    const flag = problems.includes(source) ? "✗" : "✓";
    process.stdout.write(
      `${flag} ${source.key.padEnd(22)} last ok ${source.last_success_minutes_ago}m ago · fails ${source.consecutive_failures}\n`,
    );
  }

  if (problems.length) {
    process.stderr.write(`\n${problems.length} source(s) unhealthy: ${problems.map((p) => p.key).join(", ")}\n`);
    process.exit(1);
  }
  process.stdout.write("\nall sources fresh\n");
}

main().catch((err) => {
  process.stderr.write(`${err}\n`);
  process.exit(1);
});

export {};
