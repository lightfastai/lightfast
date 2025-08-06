"use client";

import type { ToolUIPart } from "ai";
import { MousePointer } from "lucide-react";
import { memo } from "react";
import { cn } from "@repo/ui/lib/utils";

interface ActionToolProps {
  toolPart: ToolUIPart;
  className?: string;
}

export const ActionTool = memo(function ActionTool({ toolPart, className }: ActionToolProps) {
  // Extract action from input
  const input = toolPart.input && typeof toolPart.input === "object" ? toolPart.input as Record<string, any> : null;
  const action = input?.action || "action";

  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <MousePointer className="h-4 w-4" />
      <span>Clicked {action}</span>
    </div>
  );
});