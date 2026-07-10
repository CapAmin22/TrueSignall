import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** <EmptyState> — docs/02 §2: lucide oversized icon + heading + one action. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed border-border py-16 text-center">
      <Icon size={40} strokeWidth={1.25} className="text-muted" />
      <p className="text-sm font-medium text-text">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted">{body}</p>}
      {actionLabel && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
