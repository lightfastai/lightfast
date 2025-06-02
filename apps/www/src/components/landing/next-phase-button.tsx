"use client";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

import { useBinaryScrollState } from "../../hooks/use-binary-scroll-state";

export const NextPhaseButton = () => {
  const { currentState, changeState } = useBinaryScrollState();

  const handleNextPhase = () => {
    changeState("earlyAccess");
  };

  // Always render but sync opacity with logo using CSS variables
  return (
    <Button
      onClick={handleNextPhase}
      variant="default"
      className={cn("center-card-next-button", "absolute right-8 bottom-8")}
      aria-label="Go to next phase"
      data-visible="true"
    >
      Join Early Access
    </Button>
  );
};
