"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LIGHT_TRANSLATIONS } from "~/config/translations";
import { useTextCycle } from "~/hooks/use-text-cycle";

/**
 * LightCycleOverlay - Fullscreen animation overlay
 *
 * Cycles through "Light" in different languages before navigating to manifesto
 *
 * Features:
 * - Full-screen overlay (h-screen w-screen)
 * - Prevents body scroll when active
 * - Smooth transitions with Framer Motion
 * - Auto-cycles through translations
 * - Static mode for reverse animation
 *
 * @param isVisible - Whether the overlay is currently visible
 * @param onComplete - Callback when animation completes
 * @param variant - "cycle" to cycle through words, "static" to show for 1 second
 */
export function LightCycleOverlay({
  isVisible,
  onComplete,
  variant = "cycle",
}: {
  isVisible: boolean;
  onComplete: () => void;
  variant?: "cycle" | "static";
}) {
  // Check if we're in browser (SSR compatibility)
  const [mounted, setMounted] = useState(false);

  // Use text cycle hook for cycling through translations
  const { currentItem, start } = useTextCycle(LIGHT_TRANSLATIONS, {
    interval: 500,
    loop: false,
    onComplete,
  });

  // Mount detection
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  // Prevent body scroll when overlay is visible
  useEffect(() => {
    if (isVisible) {
      // Store original overflow style
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;

      // Prevent scrolling
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";

      return () => {
        // Restore original styles
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.width = "";
      };
    }
  }, [isVisible]);

  // Handle cycling based on variant
  useEffect(() => {
    if (!isVisible) return;

    // Static variant: just wait 1 second then complete
    if (variant === "static") {
      const timeout = setTimeout(onComplete, 1000);
      return () => clearTimeout(timeout);
    }

    // Cycle variant: start cycling through translations
    start();
  }, [isVisible, variant, start, onComplete]);

  // Don't render portal during SSR
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{
            // Slide from left when entering manifesto, from right when exiting
            x: variant === "cycle" ? "-100%" : "100%",
          }}
          animate={{
            x: "0%",
          }}
          exit={{
            // Slide to right when done cycling, to left when done exiting
            x: variant === "cycle" ? "100%" : "-100%",
          }}
          transition={{
            duration: 0.5,
            ease: [0.32, 0.72, 0, 1],
          }}
          className="fixed manifesto bg-background inset-0 z-[200] flex h-screen w-screen items-center justify-center overflow-hidden bg-background"
        >
          {variant === "cycle" && (
            <div className="flex flex-col items-center gap-4">
              <div className="text-center">
                <h1 className="text-6xl font-mono font-bold text-foreground">
                  {currentItem?.word}
                </h1>
                <p className="mt-2 text-xs font-mono text-muted-foreground">
                  {currentItem?.language}
                </p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
