"use client";

import type { ToolUIPart } from "ai";
import { Eye } from "lucide-react";
import { memo } from "react";
import { cn } from "@repo/ui/lib/utils";

interface ObserveToolProps {
  toolPart: ToolUIPart;
  className?: string;
}

export const ObserveTool = memo(function ObserveTool({ toolPart, className }: ObserveToolProps) {
  // Extract instruction from input
  const input = toolPart.input && typeof toolPart.input === "object" ? toolPart.input as Record<string, any> : null;
  const instruction = input?.instruction || "page elements";

  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <Eye className="h-4 w-4" />
      <span>Observing {instruction}</span>
    </div>
  );
});