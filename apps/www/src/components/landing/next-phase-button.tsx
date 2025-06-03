"use client";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

// import { useBinaryScrollContext } from "../../context/binary-scroll-context"; // Removed
import { useBinaryScrollStore } from "~/stores/binary-scroll-store"; // Import Zustand store

export const NextPhaseButton = () => {
  // Get manualChangeState from the Zustand store
  const manualChangeState = useBinaryScrollStore(
    (state) => state.manualChangeState,
  );

  const handleNextPhase = () => {
    manualChangeState("earlyAccess"); // Call the action from the store
  };

  // Always render but let CSS handle visibility based on scroll state
  return (
    <Button
      onClick={handleNextPhase}
      variant="default"
      className={cn("center-card-next-button")}
      aria-label="Go to next phase"
      data-visible="true"
    >
      Join Early Access
    </Button>
  );
};
