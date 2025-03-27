import React from "react";

import { cn } from "@repo/ui/lib/utils";

export const InspectorBase = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("w-96 rounded-lg border bg-background shadow-md", className)}
    {...props}
  />
));
