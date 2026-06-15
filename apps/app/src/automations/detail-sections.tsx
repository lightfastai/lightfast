import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

export function RailSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className="mb-2 text-muted-foreground/70 text-xs">{title}</h2>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

export function RailRow({
  label,
  info,
  children,
  className,
}: {
  label: string;
  info?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-8 items-center justify-between gap-3",
        className
      )}
    >
      <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
        {label}
        {info}
      </span>
      {children}
    </div>
  );
}
