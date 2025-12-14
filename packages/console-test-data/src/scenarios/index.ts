/**
 * Pre-built Test Scenarios
 *
 * Scenario functions that return arrays of SourceEvent for workflow-driven testing.
 */

import type { SourceEvent } from "@repo/console-types";

// Scenario exports
export { securityScenario } from "./security";
export { performanceScenario } from "./performance";

import { securityScenario } from "./security";
import { performanceScenario } from "./performance";

/**
 * Get all base events from pre-built scenarios
 */
const getAllBaseEvents = (): SourceEvent[] => [
  ...securityScenario(),
  ...performanceScenario(),
];

/**
 * Generate a balanced scenario with N events
 * Combines and shuffles events from all pre-built scenarios
 */
export const balancedScenario = (count: number): SourceEvent[] => {
  const allEvents = getAllBaseEvents();
  const shuffled = allEvents.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

/**
 * Stress test scenario with many events
 * Repeats and varies the base scenarios to reach the requested count
 */
export const stressScenario = (count: number): SourceEvent[] => {
  const events: SourceEvent[] = [];
  const base = getAllBaseEvents();

  while (events.length < count) {
    for (const event of base) {
      if (events.length >= count) break;
      events.push({
        ...event,
        sourceId: `${event.sourceId}:${events.length}`,
        occurredAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  }

  return events;
};
