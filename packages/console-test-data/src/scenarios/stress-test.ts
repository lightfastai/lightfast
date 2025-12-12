/**
 * Stress Test Scenarios
 *
 * Large-scale test data for load testing and performance validation.
 */

import type { TestScenario } from "../types";
import { ObservationFactory } from "../factories/observation-factory";

/**
 * Create stress test scenario with configurable size
 */
export function createStressTestScenario(size: number): TestScenario {
  const factory = new ObservationFactory();

  const observations = factory
    .withDateRange(90) // 90 days of data
    .balanced(size)
    .buildShuffled();

  return {
    name: `Stress Test (${size} observations)`,
    description: `Load test with ${size} observations across all categories`,
    observations,
    expectedResults: [
      {
        name: "Full text search under load",
        query: "security authentication oauth",
        expectedBehavior: `Should return results in <1s with ${size} observations`,
        llmShouldTrigger: true,
      },
      {
        name: "Filtered search performance",
        query: "performance optimization",
        filters: { sourceTypes: ["github"] },
        expectedBehavior: "Filters should reduce search space significantly",
      },
      {
        name: "Actor filter precision",
        query: "recent changes",
        filters: { actorNames: ["alice", "bob"] },
        expectedBehavior: "Only observations from alice and bob",
      },
    ],
  };
}

/**
 * Small stress test (100 observations)
 */
export const stressTestSmall = createStressTestScenario(100);

/**
 * Medium stress test (500 observations)
 */
export const stressTestMedium = createStressTestScenario(500);

/**
 * Large stress test (1000 observations)
 */
export const stressTestLarge = createStressTestScenario(1000);

/**
 * Extra large stress test (5000 observations)
 */
export const stressTestXL = createStressTestScenario(5000);
