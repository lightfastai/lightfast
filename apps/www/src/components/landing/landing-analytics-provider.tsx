"use client";

import { useEffect, useRef } from "react";

import { useLandingAnalytics } from "./hooks/use-landing-analytics";

export const LandingAnalyticsProvider = () => {
  const { trackLandingView, trackScrollProgress, trackEngagement } =
    useLandingAnalytics();
  const scrollProgressRef = useRef(0);
  const lastScrollTimeRef = useRef(Date.now());

  useEffect(() => {
    // Track initial landing view
    trackLandingView("hero");

    // Track scroll progress
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const documentHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress = documentHeight > 0 ? scrollTop / documentHeight : 0;

      // Only track scroll progress at meaningful intervals (every 10%)
      const progressPercent = Math.round(progress * 100);
      const lastProgressPercent = Math.round(scrollProgressRef.current * 100);

      if (
        progressPercent !== lastProgressPercent &&
        progressPercent % 10 === 0
      ) {
        trackScrollProgress(progress);
        scrollProgressRef.current = progress;
      }

      // Track scroll pauses (when user stops scrolling for 2 seconds)
      const now = Date.now();
      lastScrollTimeRef.current = now;

      setTimeout(() => {
        if (lastScrollTimeRef.current === now) {
          trackEngagement("scroll_pause");
        }
      }, 2000);
    };

    // Track mouse movement engagement
    let mouseMoveTimeout: NodeJS.Timeout;
    const handleMouseMove = () => {
      clearTimeout(mouseMoveTimeout);
      mouseMoveTimeout = setTimeout(() => {
        trackEngagement("mouse_movement");
      }, 1000);
    };

    // Track time spent on page
    const startTime = Date.now();
    const trackTimeSpent = () => {
      const timeSpent = Date.now() - startTime;
      if (timeSpent > 30000) {
        // Track if user stays more than 30 seconds
        trackEngagement("scroll_pause");
      }
    };

    // Add event listeners
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Track time spent after 30 seconds
    const timeSpentTimer = setTimeout(trackTimeSpent, 30000);

    // Cleanup
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouseMove);
      clearTimeout(mouseMoveTimeout);
      clearTimeout(timeSpentTimer);
    };
  }, [trackLandingView, trackScrollProgress, trackEngagement]);

  // This component renders nothing - it only provides analytics
  return null;
};
