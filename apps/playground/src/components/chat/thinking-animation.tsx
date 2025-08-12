"use client";

import { memo } from "react";
import { cn } from "@repo/ui/lib/utils";

interface ThinkingAnimationProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Memoized thinking animation component
 * Displays an animated square with gradient effects
 * Uses Tailwind animations instead of styled-jsx
 */
export const ThinkingAnimation = memo(function ThinkingAnimation({ 
  size = "md",
  className 
}: ThinkingAnimationProps) {
  const sizeClasses = {
    sm: "w-2.5 h-2.5",
    md: "w-3 h-3", 
    lg: "w-4 h-4"
  };
  
  return (
    <div className={cn("relative", sizeClasses[size], className)}>
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