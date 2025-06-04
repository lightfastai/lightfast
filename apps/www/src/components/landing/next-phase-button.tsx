"use client";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

// import { useBinaryScrollContext } from "../../context/binary-scroll-context"; // Removed
import { useBinaryScrollStore } from "~/stores/binary-scroll-store"; // Import Zustand store
import { useLandingAnalytics } from "./hooks/use-landing-analytics";

export const NextPhaseButton = () => {
  const { trackCTAClick, trackPhaseTransition } = useLandingAnalytics();

  // Get manualChangeState from the Zustand store
  const manualChangeState = useBinaryScrollStore(
    (state) => state.manualChangeState,
  );

  const handleNextPhase = () => {
    // Track the CTA click
    trackCTAClick("next_phase");

    // Track phase transition
    trackPhaseTransition("landing", "earlyAccess");

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
