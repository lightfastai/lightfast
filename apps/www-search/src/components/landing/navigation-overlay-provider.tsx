"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LightCycleOverlay } from "./light-cycle-overlay";

interface NavigationOverlayContextValue {
  navigateToManifesto: () => void;
  navigateFromManifesto: (route: string) => void;
}

const NavigationOverlayContext = createContext<
  NavigationOverlayContextValue | undefined
>(undefined);

/**
 * NavigationOverlayProvider
 *
 * Provides shared navigation overlay state that persists across route group changes.
 * This ensures the overlay animation isn't interrupted when navigating between
 * (search) and other route groups.
 */
export function NavigationOverlayProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [showAnimation, setShowAnimation] = useState(false);
  const [showReverseAnimation, setShowReverseAnimation] = useState(false);

  /**
   * Navigate to manifesto page with forward animation
   */
  const navigateToManifesto = useCallback(() => {
    // Start the forward animation
    setShowAnimation(true);

    // Navigate after a few words have cycled (not waiting for all)
    // This happens while overlay is still visible covering the screen
    setTimeout(() => {
      router.push("/manifesto");
    }, 1500); // Navigate after ~3 words (500ms * 3)

    // Remove overlay after full animation completes
    setTimeout(() => {
      setShowAnimation(false);
    }, 5500); // Full cycle duration + slide out time
  }, [router]);

  /**
   * Navigate from manifesto page with reverse animation
   */
  const navigateFromManifesto = useCallback(
    (route: string) => {
      setShowReverseAnimation(true);
      // Navigate immediately while overlay covers transition
      router.push(route);
      // Keep overlay visible for transition, then remove
      setTimeout(() => setShowReverseAnimation(false), 1500);
    },
    [router]
  );

  return (
    <NavigationOverlayContext.Provider
      value={{ navigateToManifesto, navigateFromManifesto }}
    >
      {/* Forward animation overlay (to manifesto) */}
      <LightCycleOverlay
        isVisible={showAnimation}
        onComplete={() => {
          // Animation handles its own lifecycle now
        }}
        variant="cycle"
      />

      {/* Reverse animation overlay (from manifesto) */}
      <LightCycleOverlay
        isVisible={showReverseAnimation}
        onComplete={() => {
          // Animation handles its own lifecycle now
        }}
        variant="static"
      />

      {children}
    </NavigationOverlayContext.Provider>
  );
}

/**
 * Hook to access navigation overlay controls
 */
export function useNavigationOverlay() {
  const context = useContext(NavigationOverlayContext);
  if (!context) {
    throw new Error(
      "useNavigationOverlay must be used within NavigationOverlayProvider"
    );
  }
  return context;
}
