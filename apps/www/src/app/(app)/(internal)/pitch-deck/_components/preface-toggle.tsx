"use client";

import { PanelLeft } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { usePitchDeck } from "./pitch-deck-context";

export function PrefaceToggle({ className }: { className?: string }) {
  const { prefaceExpanded, togglePreface } = usePitchDeck();

  return (
    <Button
      variant="ghost"
      onClick={togglePreface}
      className={cn(className)}
      aria-label={
        prefaceExpanded ? "Collapse founder note" : "Expand founder note"
      }
    >
      <PanelLeft
        className={cn(
          "size-4 transition-transform",
          !prefaceExpanded && "rotate-180",
        )}
      />
    </Button>
  );
}
