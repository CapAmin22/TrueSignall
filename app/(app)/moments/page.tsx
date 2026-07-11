"use client";

/**
 * S12 · Moments — the personal-signal feed. Birthdays, babies, new homes,
 * promotions: human reasons to reach out with zero pitch. Relationship
 * first; the pipeline follows.
 */
import { useMemo, useState } from "react";
import {
  Cake,
  Baby,
  Home,
  Briefcase,
  TrendingUp,
  CalendarHeart,
  Gem,
  Trophy,
  Mic,
  BookOpen,
  Rocket,
  GraduationCap,
  HeartHandshake,
} from "lucide-react";
import { useDemoStore } from "@/lib/demo/store";
import { copy } from "@/lib/copy";
import { relativeTime } from "@/lib/utils";
import {
  isActionableMoment,
  upcomingBirthdays,
  computeWarmth,
} from "@/lib/relationships/warmth";
import type { Connection, PersonalSignal, PersonalSignalType } from "@/lib/relationships/types";
import { PersonalNoteComposer } from "@/components/network/PersonalNoteComposer";
import { SourceBadge } from "@/components/shared/SourceBadge";
import { ChannelGuidance } from "@/components/shared/ChannelGuidance";
import { recommendMomentChannel } from "@/lib/channels/recommend";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/primitives";

const MOMENT_ICONS: Record<PersonalSignalType, typeof Cake> = {
  birthday: Cake,
  new_baby: Baby,
  new_home: Home,
  job_change: Briefcase,
  promotion: TrendingUp,
  work_anniversary: CalendarHeart,
  wedding: Gem,
  award: Trophy,
  speaking: Mic,
  published: BookOpen,
  company_milestone: Rocket,
  education: GraduationCap,
};

function momentLabel(type: PersonalSignalType): string {
  return type.replace(/_/g, " ");
}

export default function MomentsPage() {
  const store = useDemoStore();
  const [composer, setComposer] = useState<{ connection: Connection; moment: PersonalSignal } | null>(null);

  const connectionById = useMemo(
    () => new Map(store.connections.map((c) => [c.id, c])),
    [store.connections],
  );

  // Birthday moments are derived from stored birthdays — no source needed.
  const birthdayMoments: PersonalSignal[] = useMemo(
    () =>
      upcomingBirthdays(store.connections, 14).map(({ connection, inDays }) => ({
        id: `bd-${connection.id}`,
        connection_id: connection.id,
        type: "birthday" as const,
        title:
          inDays === 0
            ? `${connection.full_name}'s birthday is today`
            : `${connection.full_name}'s birthday in ${inDays} day${inDays === 1 ? "" : "s"}`,
        detail: connection.notes,
        source: "birthday_calendar",
        source_url: null,
        occurred_at: new Date().toISOString(),
        status: "new" as const,
      })),
    [store.connections],
  );

  const actionable = useMemo(() => {
    const stored = store.moments.filter((m) => isActionableMoment(m));
    const dismissedBirthdays = new Set(
      store.moments.filter((m) => m.status !== "new").map((m) => m.id),
    );
    const birthdays = birthdayMoments.filter((b) => !dismissedBirthdays.has(b.id));
    return [...birthdays, ...stored].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  }, [store.moments, birthdayMoments]);

  const openComposer = (moment: PersonalSignal) => {
    const connection = connectionById.get(moment.connection_id);
    if (connection) setComposer({ connection, moment });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold text-text">{copy.moments.title}</h1>
      <p className="mb-6 text-sm text-muted">{copy.moments.sub}</p>

      {actionable.length === 0 ? (
        <EmptyState icon={HeartHandshake} title={copy.moments.empty} body="Moments come from your connections' birthdays, LinkedIn clips, and news — the more of your network you import, the more you catch." />
      ) : (
        <div className="space-y-3">
          {actionable.map((moment) => {
            const connection = connectionById.get(moment.connection_id);
            if (!connection) return null;
            const Icon = MOMENT_ICONS[moment.type];
            const warmth = computeWarmth(connection);
            return (
              <Card key={moment.id} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{moment.title}</p>
                  {moment.detail && <p className="mt-0.5 text-xs text-muted">{moment.detail}</p>}
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    {connection.title ? `${connection.title}` : "Connection"}
                    {connection.company_name ? ` · ${connection.company_name}` : ""} ·{" "}
                    <span className="capitalize">{warmth.band}</span> relationship ·{" "}
                    <SourceBadge source={moment.source} sourceUrl={moment.source_url} compact />
                    {moment.source !== "birthday_calendar" && (
                      <>
                        <span>·</span>
                        <span>detected {relativeTime(moment.occurred_at)}</span>
                      </>
                    )}
                  </p>
                  <div className="mt-1.5">
                    <ChannelGuidance
                      recommendation={recommendMomentChannel(moment.type, moment.source, warmth.band)}
                      compact
                    />
                  </div>
                </div>
                <Badge tone="signal" className="shrink-0 capitalize">
                  {momentLabel(moment.type)}
                </Badge>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <Button size="sm" variant="primary" onClick={() => openComposer(moment)}>
                    {copy.moments.writeNote}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => store.setMomentStatus(moment, "dismissed")}
                  >
                    {copy.moments.dismiss}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {composer && (
        <PersonalNoteComposer
          connection={composer.connection}
          moment={composer.moment}
          onClose={() => setComposer(null)}
        />
      )}
    </div>
  );
}
