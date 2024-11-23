import React from "react";

import { cn } from "@repo/ui/lib/utils";

export const BaseNodeComponent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { selected?: boolean }
>(({ className, selected, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-md border bg-card text-card-foreground",
      className,
      selected ? "ring-1" : "",
      "hover:ring-1",
    )}
    {...props}
  />
));
BaseNodeComponent.displayName = "BaseNodeComponent";
