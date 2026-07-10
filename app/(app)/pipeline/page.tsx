"use client";

/**
 * S7 · Pipeline — 5-column kanban with drag-drop, Hot counts,
 * Re-Engage-Now float-to-top (docs/02 §5, PM-01..03).
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Flame } from "lucide-react";
import { useDemoStore, companies, signals } from "@/lib/demo/store";
import { cn, relativeTime } from "@/lib/utils";
import { UrgencyRing } from "@/components/signal/UrgencyRing";
import { Badge } from "@/components/ui/primitives";
import type { Account, Stage } from "@/lib/demo/types";

const COLUMNS: { stage: Stage; label: string }[] = [
  { stage: "identified", label: "Identified" },
  { stage: "contacted", label: "Contacted" },
  { stage: "responded", label: "Responded" },
  { stage: "meeting_booked", label: "Meeting Booked" },
  { stage: "proposal_sent", label: "Proposal Sent" },
];

function PipelineCard({ account, dragging = false }: { account: Account; dragging?: boolean }) {
  const company = companies.find((c) => c.id === account.company_id)!;
  const lastSignal = signals
    .filter((s) => s.company_id === account.company_id)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];

  return (
    <div
      className={cn(
        "rounded-[10px] border border-border bg-surface p-3 shadow-sm transition-shadow",
        dragging && "shadow-md ring-2 ring-primary/30",
        account.re_engage && "border-l-2 border-l-hot",
      )}
    >
      <div className="flex items-center gap-2">
        <Link
          href={`/accounts/${account.id}`}
          className="truncate text-sm font-medium text-text hover:text-primary"
        >
          {company.name}
        </Link>
        <UrgencyRing score={account.urgency_score} showBadge={false} className="ml-auto" />
      </div>
      {lastSignal && (
        <p className="mt-1 truncate text-xs text-muted">
          {lastSignal.title} · {relativeTime(lastSignal.occurred_at)}
        </p>
      )}
      <p className="mt-0.5 text-xs text-muted">
        {account.last_outreach_at
          ? `Last outreach ${relativeTime(account.last_outreach_at)}`
          : "No outreach yet"}
      </p>
      {account.re_engage && (
        <Badge tone="hot" className="mt-1.5">
          Re-Engage Now
        </Badge>
      )}
      {account.stage === "proposal_sent" && account.urgency_score >= 70 && (
        <Badge tone="hot" className="mt-1.5">
          <Flame size={10} />
          Hot — Act Now
        </Badge>
      )}
    </div>
  );
}

function DraggableCard({ account }: { account: Account }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: account.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cn("cursor-grab", isDragging && "opacity-40")}>
      <PipelineCard account={account} />
    </div>
  );
}

function Column({ stage, label, accounts }: { stage: Stage; label: string; accounts: Account[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const hotCount = accounts.filter((a) => a.urgency_score >= 70).length;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[420px] w-64 shrink-0 flex-col gap-2 rounded-[10px] border border-border bg-background/60 p-2.5",
        isOver && "border-primary/50 bg-primary/5",
      )}
    >
      <div className="flex items-center gap-1.5 px-1 text-xs font-semibold text-text">
        {label}
        <span className="text-muted">· {accounts.length}</span>
        {hotCount > 0 && (
          <span className="ml-auto flex items-center gap-0.5 text-hot">
            <Flame size={11} />
            {hotCount}
          </span>
        )}
      </div>
      {accounts.map((a) => (
        <DraggableCard key={a.id} account={a} />
      ))}
    </div>
  );
}

export default function PipelinePage() {
  const store = useDemoStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<"all" | "mine">("all");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byColumn = useMemo(() => {
    const visible = store.accounts.filter(
      (a) => a.status !== "archived" && (ownerFilter === "all" || a.owner_id === "u-amin"),
    );
    const map = new Map<Stage, Account[]>();
    for (const { stage } of COLUMNS) {
      const list = visible
        .filter((a) => a.stage === stage)
        .sort((a, b) => Number(b.re_engage) - Number(a.re_engage) || b.urgency_score - a.urgency_score);
      map.set(stage, list);
    }
    return map;
  }, [store.accounts, ownerFilter]);

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const target = e.over?.id;
    if (target && COLUMNS.some((c) => c.stage === target)) {
      store.setStage(String(e.active.id), target as Stage);
    }
  };

  const activeAccount = activeId ? store.accounts.find((a) => a.id === activeId) : null;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-semibold text-text">Pipeline</h1>
        <div className="ml-auto flex gap-1 rounded-[8px] border border-border p-0.5">
          {(["mine", "all"] as const).map((f) => (
            <button
              key={f}
              className={cn(
                "rounded-[6px] px-2.5 py-1 text-xs capitalize",
                ownerFilter === f ? "bg-primary/10 font-medium text-primary" : "text-muted",
              )}
              onClick={() => setOwnerFilter(f)}
            >
              {f === "mine" ? "My accounts" : "All"}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-4 text-xs text-muted">
        Stages auto-advance on send and reply events — drag to override.
      </p>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUMNS.map(({ stage, label }) => (
            <Column key={stage} stage={stage} label={label} accounts={byColumn.get(stage) ?? []} />
          ))}
        </div>
        <DragOverlay>{activeAccount ? <PipelineCard account={activeAccount} dragging /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
