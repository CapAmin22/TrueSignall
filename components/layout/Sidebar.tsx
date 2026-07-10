"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Radio,
  HeartHandshake,
  Users,
  Compass,
  Building2,
  KanbanSquare,
  Send,
  Swords,
  Settings,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { copy } from "@/lib/copy";

const NAV = [
  { href: "/feed", label: copy.nav.feed, icon: Radio },
  { href: "/moments", label: copy.nav.moments, icon: HeartHandshake },
  { href: "/network", label: copy.nav.network, icon: Users },
  { href: "/discover", label: copy.nav.discover, icon: Compass },
  { href: "/accounts", label: copy.nav.accounts, icon: Building2 },
  { href: "/pipeline", label: copy.nav.pipeline, icon: KanbanSquare },
  { href: "/outreach", label: copy.nav.outreach, icon: Send },
  { href: "/competitors", label: copy.nav.competitors, icon: Swords },
  { href: "/settings/profile", label: copy.nav.settings, icon: Settings, prefix: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface md:flex">
      <Link href="/feed" className="flex items-center gap-2 px-5 py-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-primary text-white">
          <Zap size={15} />
        </span>
        <span className="text-sm font-semibold text-text">{copy.appName}</span>
      </Link>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon, prefix }) => {
          const active = pathname.startsWith(prefix ?? href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted hover:bg-border/40 hover:text-text",
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-4 text-xs text-muted">
        <p className="font-medium text-text">TrueSignall</p>
        <p>Trial · 9 days left</p>
      </div>
    </aside>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const tabs = NAV.slice(0, 5);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface md:hidden">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]",
              active ? "text-primary" : "text-muted",
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
