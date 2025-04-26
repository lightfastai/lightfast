import React from "react";

import { cn } from "@repo/ui/lib/utils";

export const BaseNodeComponent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { selected?: boolean }
>(({ className, selected, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "bg-card text-card-foreground rounded-md border",
      className,
      selected ? "ring-1" : "",
      "hover:ring-1",
    )}
    {...props}
  />
));
BaseNodeComponent.displayName = "BaseNodeComponent";
