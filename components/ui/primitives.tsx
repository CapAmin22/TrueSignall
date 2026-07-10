import { cn } from "@/lib/utils";
import type { HTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[10px] border border-border bg-surface p-4 shadow-sm transition-all duration-150",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = "muted",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "muted" | "signal" | "warn" | "hot" | "info" | "primary" | "launch" }) {
  const tones = {
    muted: "bg-border/50 text-muted",
    signal: "bg-signal/10 text-signal",
    warn: "bg-warn/10 text-warn",
    hot: "bg-hot/10 text-hot",
    info: "bg-info/10 text-info",
    primary: "bg-primary/10 text-primary",
    launch: "bg-launch/10 text-launch",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-[8px] border border-border bg-surface px-3 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-[8px] border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 rounded-[8px] border border-border bg-surface px-2.5 text-sm text-text focus:border-primary focus:outline-none cursor-pointer",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Chip({
  className,
  active,
  ...props
}: HTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-surface text-muted hover:text-text",
        className,
      )}
      {...props}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[8px] bg-border/60", className)} />;
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary",
        className,
      )}
      title={name}
    >
      {initials}
    </span>
  );
}

export function Meter({ used, limit, className }: { used: number; limit: number; className?: string }) {
  const ratio = limit === 0 ? 0 : Math.min(1, used / limit);
  const tone = ratio >= 1 ? "bg-hot" : ratio >= 0.8 ? "bg-warn" : "bg-primary";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-border/60", className)}>
      <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}
