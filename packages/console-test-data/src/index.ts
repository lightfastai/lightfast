/**
 * @repo/console-test-data
 *
 * Workflow-driven test data generation for neural memory E2E testing.
 *
 * @example
 * ```typescript
 * import {
 *   day2RetrievalScenario,
 *   triggerObservationCapture,
 *   waitForCapture,
 *   verify,
 *   printReport,
 * } from '@repo/console-test-data';
 *
 * // Generate test events
 * const events = day2RetrievalScenario();
 *
 * // Trigger workflow
 * const triggerResult = await triggerObservationCapture(events, { workspaceId });
 *
 * // Wait for completion
 * const waitResult = await waitForCapture({
 *   workspaceId,
 *   sourceIds: triggerResult.sourceIds,
 * });
 *
 * // Verify results
 * const verifyResult = await verify({ workspaceId, clerkOrgId, indexName });
 * printReport(verifyResult);
 * ```
 */

// Event builders
export * from "./events";

// Scenarios
export * from "./scenarios";

// Workflow trigger & wait
export * from "./trigger";

// Verification
export * from "./verifier";

// Types
export * from "./types";
