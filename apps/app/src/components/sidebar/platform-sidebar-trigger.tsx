"use client";

import { SidebarTrigger } from "@repo/ui/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";

export function PlatformSidebarTrigger() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <SidebarTrigger className="h-8 w-8" />
      </TooltipTrigger>
      <TooltipContent side="right">
        <p className="text-xs">Toggle sidebar (⌘B)</p>
      </TooltipContent>
    </Tooltip>
  );
}