"use client";

import type { ToolUIPart } from "ai";
import { Clock } from "lucide-react";
import { memo } from "react";
import { cn } from "@repo/ui/lib/utils";

interface WaitToolProps {
  toolPart: ToolUIPart;
  className?: string;
}

export const WaitTool = memo(function WaitTool({ toolPart, className }: WaitToolProps) {
  // Extract wait time from input
  const input = toolPart.input && typeof toolPart.input === "object" ? toolPart.input as Record<string, any> : null;
  const seconds = input?.seconds || input?.time || 0;

  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <Clock className="h-4 w-4" />
      <span>Waited {seconds} seconds</span>
    </div>
  );
});