/**
 * @vendor/upstash-workflow
 *
 * Vendor abstraction for Upstash Workflow SDK
 *
 * Provides a standalone, independent wrapper around @upstash/workflow
 * for durable, reliable serverless workflow orchestration.
 *
 * @example
 * ```typescript
 * // Trigger a workflow
 * import { WorkflowClient } from "@vendor/upstash-workflow";
 *
 * const client = new WorkflowClient();
 * const result = await client.trigger({
 *   url: "https://example.com/api/workflow",
 *   body: { foo: "bar" }
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Create a workflow endpoint
 * import { serve } from "@vendor/upstash-workflow/nextjs";
 *
 * export const { POST } = serve(async (context) => {
 *   const result = await context.run("step-1", async () => {
 *     return processData();
 *   });
 * });
 * ```
 */

export { WorkflowClient, getWorkflowClient } from "./client";
export { serve } from "./nextjs";
export type {
  WorkflowConfig,
  WorkflowContext,
  WorkflowHandler,
  WorkflowStep,
  WorkflowTriggerOptions,
  WorkflowTriggerResponse,
} from "./types";
