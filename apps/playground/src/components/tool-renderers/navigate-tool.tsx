"use client";

import type { ToolUIPart } from "ai";
import { Globe } from "lucide-react";
import { memo } from "react";
import { cn } from "@repo/ui/lib/utils";

interface NavigateToolProps {
  toolPart: ToolUIPart;
  className?: string;
}

export const NavigateTool = memo(function NavigateTool({ toolPart, className }: NavigateToolProps) {
  // Extract URL from input
  const url = toolPart.input && typeof toolPart.input === "object" && "url" in toolPart.input 
    ? (toolPart.input as { url: string }).url 
    : null;

  // Extract domain from URL
  const domain = url ? new URL(url).hostname.replace("www.", "") : null;

  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <Globe className="h-4 w-4" />
      <span>Navigated to {domain || url || "site"}</span>
    </div>
  );
});