/**
 * @repo/console-test-data
 *
 * Test data generation and injection for neural memory E2E testing.
 *
 * @example
 * ```typescript
 * import { ObservationFactory, TestDataInjector, scenarios } from '@repo/console-test-data';
 *
 * // Use pre-built scenario
 * const injector = new TestDataInjector({ workspaceId, clerkOrgId });
 * await injector.injectScenario(scenarios.day2Retrieval);
 *
 * // Or build custom observations
 * const factory = new ObservationFactory();
 * const observations = factory
 *   .withActor('alice')
 *   .withSource('github')
 *   .security(5)
 *   .performance(5)
 *   .build();
 *
 * await injector.inject(observations);
 * ```
 */

export * from "./factories";
export * from "./injector";
export * from "./verifier";
export * from "./scenarios";
export * from "./types";
