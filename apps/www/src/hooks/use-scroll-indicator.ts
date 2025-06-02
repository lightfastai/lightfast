"use client";

import { useEffect } from "react";

/**
 * Hook to handle scroll indicator visibility
 * Shows the indicator after loading, hides it permanently on first scroll
 */
export function useScrollIndicator() {
  useEffect(() => {
    let hasScrolled = false;

    const handleScroll = () => {
      if (!hasScrolled) {
        hasScrolled = true;
        const scrollIndicator = document.querySelector(
          ".scroll-indicator-floating",
        );
        if (scrollIndicator) {
          (scrollIndicator as HTMLElement).style.display = "none";
        }
      }
    };

    // Listen for any scroll events
    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("wheel", handleScroll, { passive: true });
    document.addEventListener("touchmove", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("wheel", handleScroll);
      document.removeEventListener("touchmove", handleScroll);
    };
  }, []);
}
