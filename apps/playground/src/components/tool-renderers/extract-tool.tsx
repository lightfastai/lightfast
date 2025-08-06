"use client";

import type { ToolUIPart } from "ai";
import { FileText } from "lucide-react";
import { memo } from "react";
import { cn } from "@repo/ui/lib/utils";

interface ExtractToolProps {
  toolPart: ToolUIPart;
  className?: string;
}

export const ExtractTool = memo(function ExtractTool({ toolPart, className }: ExtractToolProps) {
  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <FileText className="h-4 w-4" />
      <span>Extracting data</span>
    </div>
  );
});