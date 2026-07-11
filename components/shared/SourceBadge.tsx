"use client";

/**
 * <SourceBadge> — trust surface for signal provenance.
 * Shows where a signal was captured (platform icon + name) with a clickable
 * link to the original source so the founder can verify authenticity.
 *
 * Philosophy: if TrueSignall says "Acme raised $12M" the founder should be
 * able to click through and read the TechCrunch article themselves. Trust
 * is built by showing the receipts.
 */
import {
  ExternalLink,
  MessageSquareMore,
  Rss,
  Globe,
  Newspaper,
  Code,
  Eye,
  UserCheck,
  Briefcase,
  Rocket,
  AtSign,
  Heart,
  FileText,
} from "lucide-react";
import { sourceToPlatform } from "@/lib/channels/recommend";
import { cn } from "@/lib/utils";

const SOURCE_ICONS: Record<string, typeof Rss> = {
  clipper: MessageSquareMore,
  linkedin_clip: MessageSquareMore,
  techcrunch_rss: Newspaper,
  finsmes_rss: Newspaper,
  eu_startups_rss: Newspaper,
  prnewswire_rss: FileText,
  businesswire_rss: FileText,
  google_news_account: Newspaper,
  greenhouse_boards: Briefcase,
  lever_postings: Briefcase,
  ashby_boards: Briefcase,
  workable_widget: Briefcase,
  careers_diff: Briefcase,
  tech_detect: Code,
  producthunt_gql: Rocket,
  github_events: Code,
  champion_news: UserCheck,
  pixel: Eye,
  rb2b: Eye,
  twitter_search: AtSign,
  x_search: AtSign,
  birthday_calendar: Heart,
  news: Newspaper,
  manual: Globe,
  edgar_form_d: FileText,
};

const SOURCE_COLORS: Record<string, string> = {
  clipper: "text-[#0A66C2]",
  linkedin_clip: "text-[#0A66C2]",
  twitter_search: "text-[#1DA1F2]",
  x_search: "text-[#1DA1F2]",
  pixel: "text-signal",
  rb2b: "text-signal",
  producthunt_gql: "text-[#FF6154]",
  github_events: "text-text",
  birthday_calendar: "text-hot",
};

export function SourceBadge({
  source,
  sourceUrl,
  compact = false,
  className,
}: {
  source: string;
  sourceUrl: string | null;
  compact?: boolean;
  className?: string;
}) {
  const Icon = SOURCE_ICONS[source] ?? Globe;
  const platform = sourceToPlatform(source);
  const color = SOURCE_COLORS[source] ?? "text-muted";

  if (compact) {
    const content = (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[11px]",
          sourceUrl ? "hover:text-primary cursor-pointer" : "",
          color,
          className,
        )}
        title={sourceUrl ? `Captured from ${platform} — click to verify` : `Source: ${platform}`}
      >
        <Icon size={11} />
        <span className="capitalize">{platform}</span>
        {sourceUrl && <ExternalLink size={9} className="opacity-60" />}
      </span>
    );

    if (sourceUrl) {
      return (
        <a href={sourceUrl} target="_blank" rel="noreferrer">
          {content}
        </a>
      );
    }
    return content;
  }

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs transition-colors",
        sourceUrl ? "hover:border-primary/40 hover:bg-primary/5 cursor-pointer" : "",
        className,
      )}
      title={sourceUrl ? `Captured from ${platform} — click to verify` : `Source: ${platform}`}
    >
      <Icon size={13} className={color} />
      <span className="font-medium text-text">{platform}</span>
      {sourceUrl && (
        <ExternalLink size={10} className="text-muted" />
      )}
    </span>
  );

  if (sourceUrl) {
    return (
      <a href={sourceUrl} target="_blank" rel="noreferrer" className="no-underline">
        {badge}
      </a>
    );
  }

  return badge;
}
