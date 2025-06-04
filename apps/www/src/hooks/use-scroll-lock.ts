"use client";

import { useEffect } from "react";

// Custom hook to handle scroll locking during loading animations

export const useScrollLock = (lockDuration: number): void => {
  useEffect(() => {
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
      const scrollKeys = [
        " ", // Space
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "PageUp",
        "PageDown",
        "Home",
        "End",
      ];

      if (scrollKeys.includes(e.key)) {
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
    }, lockDuration);

    // Cleanup on unmount
    return () => {
      clearTimeout(timeoutId);
      document.documentElement.classList.remove("landing-scroll-locked");
      document.body.classList.remove("landing-scroll-locked");
      document.removeEventListener("wheel", preventDefault);
      document.removeEventListener("touchmove", preventDefault);
      document.removeEventListener("keydown", preventKeys);
    };
  }, [lockDuration]);
};
