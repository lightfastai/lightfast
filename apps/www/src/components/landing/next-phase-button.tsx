"use client";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

// import { useBinaryScrollContext } from "../../context/binary-scroll-context"; // Removed
import { useBinaryScrollStore } from "~/stores/binary-scroll-store"; // Import Zustand store

export const NextPhaseButton = () => {
  // Get manualChangeState from the Zustand store
  // currentState can also be selected if needed for conditional logic/styling
  const manualChangeState = useBinaryScrollStore(
    (state) => state.manualChangeState,
  );
  // const currentState = useBinaryScrollStore((state) => state.currentState); // Example if needed

  const handleNextPhase = () => {
    manualChangeState("earlyAccess"); // Call the action from the store
  };

  // Always render but sync opacity with logo using CSS variables
  return (
    <Button
      onClick={handleNextPhase}
      variant="default"
      className={cn("center-card-next-button", "absolute right-8 bottom-8")}
      aria-label="Go to next phase"
      data-visible="true" // This might need to be dynamic based on currentState
    >
      Join Early Access
    </Button>
  );
};
