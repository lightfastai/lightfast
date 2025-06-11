"use client";

import { useEffect, useRef } from "react";
import { fixIOSScrollBehavior } from "~/lib/safari-compatibility";

// Custom hook to handle scroll locking during loading animations

export const useScrollLock = (duration: number): void => {
  const isLockedRef = useRef(false);

  useEffect(() => {
    const lockScroll = () => {
      if (isLockedRef.current) return;
      isLockedRef.current = true;
      
      // Use Safari-specific fix for iOS
      fixIOSScrollBehavior(true);
      
      // Standard scroll lock for other browsers
      document.documentElement.classList.add("landing-scroll-locked");
      document.body.classList.add("landing-scroll-locked");

      // Store current scroll position for non-iOS Safari browsers
      const scrollY = window.scrollY;
      document.body.style.setProperty("--scroll-y", `${scrollY}px`);
    };

    const unlockScroll = () => {
      if (!isLockedRef.current) return;
      isLockedRef.current = false;
      
      // Use Safari-specific fix for iOS
      fixIOSScrollBehavior(false);
      
      // Standard unlock for other browsers
      document.documentElement.classList.remove("landing-scroll-locked");
      document.body.classList.remove("landing-scroll-locked");

      // Restore scroll position for non-iOS Safari browsers
      const scrollY = document.body.style.getPropertyValue("--scroll-y");
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY, 10));
        document.body.style.removeProperty("--scroll-y");
      }
    };

    // Lock scroll immediately
    lockScroll();

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
      unlockScroll();

      // Remove event listeners
      document.removeEventListener("wheel", preventDefault);
      document.removeEventListener("touchmove", preventDefault);
      document.removeEventListener("keydown", preventKeys);
    }, duration);

    // Cleanup on unmount
    return () => {
      clearTimeout(timeoutId);
      unlockScroll();
      document.removeEventListener("wheel", preventDefault);
      document.removeEventListener("touchmove", preventDefault);
      document.removeEventListener("keydown", preventKeys);
    };
  }, [duration]);
};
