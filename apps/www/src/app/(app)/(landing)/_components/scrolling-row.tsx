"use client";

import type { Integration } from "~/config/integrations";
import "./integrations.css";

interface ScrollingRowProps {
  /**
   * Array of integrations (already duplicated for seamless scroll)
   */
  integrations: Integration[];

  /**
   * Scroll direction: "left" (left→right) or "right" (right→left)
   */
  direction: "left" | "right";

  /**
   * Animation duration in seconds
   */
  duration: number;
}

/**
 * ScrollingRow Component
 *
 * Pure render component - all styling and animation handled by CSS.
 * Duplicated integrations create seamless loop (last item connects to first).
 *
 * CSS Responsibilities:
 * - Keyframe animations (scrollLeft, scrollRight)
 * - Layout (flexbox, gaps, alignment)
 * - Card styling (colors, borders, typography)
 * - Responsive adjustments
 */
export function ScrollingRow({
  integrations,
  direction,
  duration,
}: ScrollingRowProps) {
  return (
    <div className="w-full h-full overflow-hidden">
      <div
        className={`scrolling-container scroll-${direction}`}
        style={{
          "--integrations-scroll-duration": `${duration}s`,
        } as React.CSSProperties}
      >
        {/* Render each integration card */}
        {integrations.map((integration, index) => (
          <div
            key={`${integration.id}-${index}`}
            className="integration-card"
          >
            {integration.name}
          </div>
        ))}
      </div>
    </div>
  );
}
