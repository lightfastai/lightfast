"use client";

import { memo } from "react";

/**
 * Memoized thinking animation component
 * Displays an animated square with gradient effects
 * Uses Tailwind animations instead of styled-jsx
 */
export const ThinkingAnimation = memo(function ThinkingAnimation() {
  return (
    <div className="relative w-3 h-3">
      {/* Square shape with animated gradient inside */}
      <div className="absolute inset-0 rounded-sm overflow-hidden">
        {/* Animated gradient background */}
        <div
          className="absolute inset-0 animate-gradient-shift"
          style={{
            background: "linear-gradient(135deg, #9333ea 0%, #3b82f6 25%, #ec4899 50%, #9333ea 75%, #3b82f6 100%)",
            backgroundSize: "400% 400%",
          }}
        />
      </div>

      {/* Glow effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-purple-600/40 via-blue-600/40 to-pink-600/40 blur-lg rounded-sm animate-pulse-soft" />
    </div>
  );
});