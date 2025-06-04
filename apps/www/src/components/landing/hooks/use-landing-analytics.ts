"use client";

import { useCallback } from "react";

import { usePosthogAnalytics } from "@vendor/analytics/posthog-client";

export const useLandingAnalytics = () => {
  const posthog = usePosthogAnalytics();

  const trackLandingView = useCallback(
    (section?: string) => {
      posthog.capture("landing_section_view", {
        section: section ?? "hero",
        timestamp: Date.now(),
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
      });
    },
    [posthog],
  );

  const trackScrollProgress = useCallback(
    (progress: number) => {
      posthog.capture("landing_scroll_progress", {
        progress_percentage: Math.round(progress * 100),
        timestamp: Date.now(),
      });
    },
    [posthog],
  );

  const trackCTAClick = useCallback(
    (ctaType: "early_access" | "scroll_indicator" | "next_phase") => {
      posthog.capture("landing_cta_click", {
        cta_type: ctaType,
        timestamp: Date.now(),
      });
    },
    [posthog],
  );

  const trackPhaseTransition = useCallback(
    (fromPhase: string, toPhase: string) => {
      posthog.capture("landing_phase_transition", {
        from_phase: fromPhase,
        to_phase: toPhase,
        timestamp: Date.now(),
      });
    },
    [posthog],
  );

  const trackEngagement = useCallback(
    (engagementType: "scroll_pause" | "hover_element" | "mouse_movement") => {
      posthog.capture("landing_engagement", {
        engagement_type: engagementType,
        timestamp: Date.now(),
      });
    },
    [posthog],
  );

  return {
    trackLandingView,
    trackScrollProgress,
    trackCTAClick,
    trackPhaseTransition,
    trackEngagement,
  };
};
