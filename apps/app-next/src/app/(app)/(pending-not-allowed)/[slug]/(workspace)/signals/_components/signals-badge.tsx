import { Badge } from "@repo/ui/components/ui/badge";
import type { ReactNode } from "react";

/**
 * Neutral metadata tag for signal kind / priority / status. Delegates to the
 * shared Badge (outline variant) so signals, settings, and automations all
 * render the one badge primitive.
 */
export function SignalBadge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Badge className={className} variant="outline">
      {children}
    </Badge>
  );
}
