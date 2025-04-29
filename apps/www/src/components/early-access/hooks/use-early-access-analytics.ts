"use client";

import { useCallback, useRef } from "react";

import { usePosthogAnalytics } from "@vendor/analytics/posthog-client";

interface TrackEarlyAccessSignupParams {
  email: string;
  requestId: string;
}

export const useEarlyAccessAnalytics = () => {
  const posthog = usePosthogAnalytics();
  const identified = useRef(false);

  const trackSignup = useCallback(
    ({ email, requestId }: TrackEarlyAccessSignupParams) => {
      if (identified.current) {
        return;
      }

      posthog.capture("early_access_signup", {
        email,
        $set: { email }, // Set the user property
        requestId,
        // Device information is automatically captured by PostHog
        // but we can add additional properties if needed
        referrer: document.referrer,
        screen_width: window.screen.width,
        screen_height: window.screen.height,
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
        user_agent: navigator.userAgent,
        language: navigator.language,
      });

      identified.current = true;
    },
    [posthog],
  );

  return {
    trackSignup,
  };
};
