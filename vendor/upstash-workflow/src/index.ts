/**
 * @vendor/upstash-workflow
 *
 * Vendor abstraction for Upstash Workflow SDK
 *
 * Re-exports SDK primitives with env wiring for durable,
 * reliable serverless workflow orchestration.
 *
 * @example
 * ```typescript
 * import { workflowClient } from "@vendor/upstash-workflow";
 *
 * await workflowClient.trigger({
 *   url: "https://example.com/api/workflow",
 *   body: JSON.stringify({ foo: "bar" }),
 *   headers: { "Content-Type": "application/json" },
 * });
 * ```
 */

export { workflowClient } from "./client";
export { serve } from "./nextjs";
export type { Client } from "@upstash/workflow";
export type { WorkflowContext } from "@upstash/workflow";
