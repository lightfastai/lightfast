"use client";

import { PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { usePitchDeck } from "./pitch-deck-context";

export function PrefaceToggle({ className }: { className?: string }) {
  const { prefaceExpanded, togglePreface } = usePitchDeck();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={togglePreface}
      className={cn("size-8", className)}
      aria-label={prefaceExpanded ? "Collapse founder note" : "Expand founder note"}
    >
      {prefaceExpanded ? (
        <PanelLeftClose className="size-4" />
      ) : (
        <PanelLeft className="size-4" />
      )}
    </Button>
  );
}
