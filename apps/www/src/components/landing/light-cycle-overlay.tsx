"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Translations of "Light" in different languages
 * Used for the manifesto page transition animation
 */
const LIGHT_TRANSLATIONS = [
  { word: "Light", language: "English" },
  { word: "Luz", language: "Spanish" },
  { word: "Lumière", language: "French" },
  { word: "Licht", language: "German" },
  { word: "Luce", language: "Italian" },
  { word: "ライト", language: "Japanese" },
  { word: "Φως", language: "Greek" },
  { word: "אור", language: "Hebrew" },
  { word: "Işık", language: "Turkish" },
];

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
  // Derive initial index from isVisible to avoid setState in effect
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted (for SSR compatibility)
  useEffect(() => {
    setMounted(true);
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

  // Cycle through translations - includes reset logic
  useEffect(() => {
    if (!isVisible) return;

    // Static variant: just wait 1 second then complete
    if (variant === "static") {
      const timeout = setTimeout(onComplete, 1000);
      return () => clearTimeout(timeout);
    }

    // Cycle variant: cycle through all words
    let index = 0;
    setCurrentIndex(0);

    const interval = setInterval(() => {
      index++;
      if (index >= LIGHT_TRANSLATIONS.length) {
        clearInterval(interval);
        // Delay before completing to show the last word
        setTimeout(onComplete, 400);
      } else {
        setCurrentIndex(index);
      }
    }, 500); // Change word every 500ms

    return () => clearInterval(interval);
  }, [isVisible, onComplete, variant]);

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
                  {LIGHT_TRANSLATIONS[currentIndex]?.word}
                </h1>
                <p className="mt-2 text-xs font-mono text-muted-foreground">
                  {LIGHT_TRANSLATIONS[currentIndex]?.language}
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
