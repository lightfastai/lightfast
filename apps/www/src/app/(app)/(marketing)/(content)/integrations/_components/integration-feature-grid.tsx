import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

export function IntegrationFeatureGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("my-12 grid grid-cols-1 gap-4 sm:grid-cols-2", className)}
    >
      {children}
    </div>
  );
}

export function IntegrationFeature({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xs border border-border/50 bg-card/40 p-6">
      <h3 className="mb-2 font-medium text-base text-foreground">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {children}
      </p>
    </div>
  );
}
