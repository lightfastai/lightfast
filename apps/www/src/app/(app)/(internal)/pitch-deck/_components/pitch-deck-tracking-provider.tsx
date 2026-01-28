"use client";

import { Suspense, createContext, useContext } from "react";
import { usePitchDeckTracking } from "./use-pitch-deck-tracking";

type TrackingContextType = ReturnType<typeof usePitchDeckTracking>;

const TrackingContext = createContext<TrackingContextType | null>(null);

// No-op functions for when tracking is unavailable
const noopTrackSlideView = (_slideIndex: number) => {
  // Intentionally empty - no tracking when provider unavailable
};
const noopTrackGridView = (_enabled: boolean) => {
  // Intentionally empty - no tracking when provider unavailable
};
const noopTrackPrefaceToggle = (_expanded: boolean) => {
  // Intentionally empty - no tracking when provider unavailable
};
const noopTrackGridItemClick = (_slideIndex: number) => {
  // Intentionally empty - no tracking when provider unavailable
};

const noopTracking: TrackingContextType = {
  trackSlideView: noopTrackSlideView,
  trackGridView: noopTrackGridView,
  trackPrefaceToggle: noopTrackPrefaceToggle,
  trackGridItemClick: noopTrackGridItemClick,
  sessionId: "",
};

export function useTracking() {
  const context = useContext(TrackingContext);
  if (!context) {
    // Return no-op functions if not in provider (safe fallback)
    return noopTracking;
  }
  return context;
}

function TrackingProviderInner({ children }: { children: React.ReactNode }) {
  const tracking = usePitchDeckTracking();

  return (
    <TrackingContext.Provider value={tracking}>
      {children}
    </TrackingContext.Provider>
  );
}

export function PitchDeckTrackingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <TrackingProviderInner>{children}</TrackingProviderInner>
    </Suspense>
  );
}
