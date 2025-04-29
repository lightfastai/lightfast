import React from "react";

import { cn } from "@repo/ui/lib/utils";

export const InspectorBase = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "bg-background z-10 w-96 rounded-md border shadow-md",
      className,
    )}
    {...props}
  />
));
