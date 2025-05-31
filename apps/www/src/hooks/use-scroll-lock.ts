"use client";

import { useEffect } from "react";

import { env } from "~/env";
import { ANIMATION_TIMING } from "~/lib/animation/constants";
import { validateAnimationTiming } from "~/lib/animation/utils";

// Custom hook to handle scroll locking during loading animations

export const useScrollLock = () => {
  useEffect(() => {
    // Development-only validation to ensure JS constants match CSS values
    if (env.NODE_ENV === "development") {
      const validation = validateAnimationTiming();
      if (!validation.isValid) {
        console.warn(
          "Animation timing mismatch detected between CSS and JavaScript constants:",
          validation.errors,
        );
      }
    }

    // Use centralized loading duration calculation
    const loadingDuration = ANIMATION_TIMING.LOADING_DURATION;

    // Lock scroll immediately
    document.documentElement.classList.add("landing-scroll-locked");
    document.body.classList.add("landing-scroll-locked");

    // Prevent wheel, touch, and keyboard scrolling
    const preventDefault = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const preventKeys = (e: KeyboardEvent) => {
      // Prevent arrow keys, space, page up/down, home/end
      if ([32, 33, 34, 35, 36, 37, 38, 39, 40].includes(e.keyCode)) {
        preventDefault(e);
      }
    };

    // Add event listeners
    document.addEventListener("wheel", preventDefault, { passive: false });
    document.addEventListener("touchmove", preventDefault, { passive: false });
    document.addEventListener("keydown", preventKeys, { passive: false });

    // Release scroll lock after animations complete
    const timeoutId = setTimeout(() => {
      document.documentElement.classList.remove("landing-scroll-locked");
      document.body.classList.remove("landing-scroll-locked");

      // Remove event listeners
      document.removeEventListener("wheel", preventDefault);
      document.removeEventListener("touchmove", preventDefault);
      document.removeEventListener("keydown", preventKeys);
    }, loadingDuration);

    // Cleanup on unmount
    return () => {
      clearTimeout(timeoutId);
      document.documentElement.classList.remove("landing-scroll-locked");
      document.body.classList.remove("landing-scroll-locked");
      document.removeEventListener("wheel", preventDefault);
      document.removeEventListener("touchmove", preventDefault);
      document.removeEventListener("keydown", preventKeys);
    };
  }, []);
};
