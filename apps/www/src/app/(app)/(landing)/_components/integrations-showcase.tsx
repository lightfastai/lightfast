"use client";

import type { Integration } from "~/config/integrations";
import { useMemo } from "react";
import { INTEGRATIONS } from "~/config/integrations";
import { ScrollingRow } from "./scrolling-row";
import "./integrations.css";

/**
 * Configuration constants for randomization logic only
 * Visual configuration (heights, gaps, durations) is in CSS via custom properties
 */
const SHOWCASE_CONFIG = {
  ITEMS_PER_ROW: 5,
  ESTIMATED_HEIGHT: 800, // For calculating row count
  ROW_HEIGHT: 80, // Must match CSS --integrations-row-height
  SCROLL_DURATION: 30, // Must match CSS --integrations-scroll-duration
} as const;

/**
 * Select N random items from the integrations array
 */
function getRandomIntegrations(count: number = SHOWCASE_CONFIG.ITEMS_PER_ROW): Integration[] {
  const shuffled = [...INTEGRATIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Duplicate items for seamless infinite scroll
 * Pattern: [item1, item2, item3, ..., item1, item2, item3, ...]
 */
function duplicateForSeamlessScroll(items: Integration[]): Integration[] {
  return [...items, ...items];
}

/**
 * Calculate how many rows fit in the available height
 */
function calculateRowsNeeded(containerHeight: number): number {
  return Math.ceil(containerHeight / SHOWCASE_CONFIG.ROW_HEIGHT);
}

/**
 * Generate row data with randomized integrations and alternating directions
 */
function generateRows(containerHeight: number) {
  const rowCount = calculateRowsNeeded(containerHeight);
  return Array.from({ length: rowCount }, (_, index) => {
    const direction = index % 2 === 0 ? ("left" as const) : ("right" as const);
    return {
      id: `row-${index}`,
      integrations: duplicateForSeamlessScroll(getRandomIntegrations()),
      direction,
    };
  });
}

/**
 * IntegrationsShowcase Component
 *
 * Renders multiple animated scrolling rows of random integrations.
 *
 * Responsibilities:
 * - JS: Randomization, row generation, data logic
 * - CSS: All layout, animations, styling, responsiveness
 *
 * Features:
 * - Random 5 integrations per row
 * - Seamless infinite horizontal scroll
 * - Alternating directions for visual interest
 * - Vertical spacing between rows
 * - Fully responsive via CSS custom properties
 */
export function IntegrationsShowcase() {
  const rows = useMemo(
    () => generateRows(SHOWCASE_CONFIG.ESTIMATED_HEIGHT),
    []
  );

  return (
    <div className="integrations-showcase">
      {rows.map((row) => (
        <div key={row.id} className="integrations-row">
          <ScrollingRow
            integrations={row.integrations}
            direction={row.direction}
            duration={SHOWCASE_CONFIG.SCROLL_DURATION}
          />
        </div>
      ))}
    </div>
  );
}
