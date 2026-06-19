"use client";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { PanelLeft } from "lucide-react";
import { usePitchDeck } from "./pitch-deck-context";

export function PrefaceToggle({ className }: { className?: string }) {
  const { prefaceExpanded, togglePreface } = usePitchDeck();

  return (
    <Button
      aria-label={
        prefaceExpanded ? "Collapse founder note" : "Expand founder note"
      }
      className={cn(className)}
      onClick={togglePreface}
      variant="ghost"
    >
      <PanelLeft
        className={cn(
          "size-4 transition-transform",
          !prefaceExpanded && "rotate-180"
        )}
      />
    </Button>
  );
}
