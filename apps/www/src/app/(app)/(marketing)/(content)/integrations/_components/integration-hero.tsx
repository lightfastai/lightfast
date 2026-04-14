import { cn } from "@repo/ui/lib/utils";
import type { ComponentType, SVGProps } from "react";

interface IntegrationHeroProps {
  className?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  status?: "live" | "beta" | "coming-soon";
  tagline: string;
  title: string;
}

export function IntegrationHero({
  title,
  tagline,
  icon: Icon,
  status,
  className,
}: IntegrationHeroProps) {
  return (
    <div className={cn("flex flex-col gap-6 py-12", className)}>
      <div className="flex items-center gap-4">
        {Icon && (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-border/50 bg-card/40">
            <Icon aria-hidden className="size-8 text-foreground" />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <h1 className="font-medium font-pp text-3xl text-foreground">
            {title}
          </h1>
          {status && status !== "live" && (
            <span className="inline-flex w-fit items-center rounded-md border border-border px-2 py-0.5 text-muted-foreground text-xs uppercase tracking-wider">
              {status === "coming-soon" ? "Coming soon" : "Beta"}
            </span>
          )}
        </div>
      </div>
      <p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
        {tagline}
      </p>
    </div>
  );
}
