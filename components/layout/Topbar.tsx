"use client";

import { useEffect, useState } from "react";
import { Search, Bell, Moon, Sun } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { workspace } from "@/lib/demo/store";

export function Topbar() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark =
      stored === "dark" ||
      (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(prefersDark);
    document.documentElement.classList.toggle("dark", prefersDark);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur md:px-6">
      <span className="rounded-[8px] border border-border px-2.5 py-1 text-xs font-medium text-text">
        {workspace.name}
      </span>
      <button
        className="hidden items-center gap-2 rounded-[8px] border border-border px-3 py-1.5 text-xs text-muted hover:border-primary/40 md:flex"
        aria-label="Search"
      >
        <Search size={13} />
        Search accounts, actions…
        <kbd className="rounded border border-border px-1 font-mono text-[10px]">⌘K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-2">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-muted hover:bg-border/40 hover:text-text"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-[8px] text-muted hover:bg-border/40 hover:text-text"
          aria-label="Notifications"
        >
          <Bell size={16} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-hot" />
        </button>
        <Avatar name={workspace.founder_name} className="h-8 w-8 text-xs" />
      </div>
    </header>
  );
}
