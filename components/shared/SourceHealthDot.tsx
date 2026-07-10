import { cn } from "@/lib/utils";

/** <SourceHealthDot> — settings/admin source health (docs/02 §4, 05 §10). */
export function SourceHealthDot({
  consecutiveFailures,
  enabled,
}: {
  consecutiveFailures: number;
  enabled: boolean;
}) {
  const state = !enabled || consecutiveFailures >= 5 ? "down" : consecutiveFailures > 0 ? "flaky" : "ok";
  const styles = {
    ok: "bg-signal",
    flaky: "bg-warn",
    down: "bg-hot",
  };
  const labels = { ok: "Healthy", flaky: "Intermittent failures", down: "Paused" };
  return (
    <span
      className={cn("inline-block h-2 w-2 rounded-full", styles[state])}
      title={labels[state]}
      aria-label={labels[state]}
    />
  );
}
