import { Badge } from "@repo/ui/components/ui/badge";
import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * Neutral metadata badge for signal kind / priority / status.
 * Sized to match the toolbar controls: h-6 (24px), rounded-lg (4px),
 * border + subtle muted fill — the same control family as the filter chip.
 */
export function SignalBadge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        "h-6 rounded-lg border-border/70 bg-muted/25 px-2 font-normal text-foreground text-sm",
        className
      )}
      variant="outline"
    >
      {children}
    </Badge>
  );
}
