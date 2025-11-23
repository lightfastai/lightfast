import { serve as upstashServe } from "@upstash/workflow/nextjs";
import type { WorkflowHandler } from "./types";

/**
 * Create a Next.js API route handler for a workflow
 *
 * This wraps the Upstash Workflow serve function with better type safety
 * and automatic error handling.
 *
 * @example
 * ```typescript
 * // app/api/workflow/route.ts
 * import { serve } from "@vendor/upstash-workflow/nextjs";
 *
 * export const { POST } = serve<MyPayload>(async (context) => {
 *   const payload = context.requestPayload;
 *
 *   const result1 = await context.run("step-1", async () => {
 *     // Your business logic
 *     return processData(payload);
 *   });
 *
 *   await context.run("step-2", async () => {
 *     // Chain steps
 *     return sendNotification(result1);
 *   });
 * });
 * ```
 */
export function serve<TPayload = unknown>(
  handler: WorkflowHandler,
  options?: {
    /**
     * Enable verbose logging
     */
    verbose?: boolean;

    /**
     * Disable telemetry
     */
    disableTelemetry?: boolean;
  },
) {
  // Wrap handler with error logging
  const wrappedHandler: WorkflowHandler = async (context) => {
    try {
      if (options?.verbose) {
        console.log("[Workflow] Starting workflow execution", {
          headers: context.headers,
          requestPayload: context.requestPayload,
        });
      }

      await handler(context);

      if (options?.verbose) {
        console.log("[Workflow] Workflow completed successfully");
      }
    } catch (error) {
      console.error("[Workflow] Workflow execution failed:", error);
      throw error;
    }
  };

  return upstashServe<TPayload>(wrappedHandler, {
    disableTelemetry: options?.disableTelemetry ?? false,
  });
}

/**
 * Type-safe workflow context utilities
 *
 * Note: These are thin wrappers around the WorkflowContext methods.
 * Use them directly from context for full type safety:
 *
 * @example
 * ```typescript
 * await context.sleep("30s");
 * await context.sleepUntil(Date.now() + 60000);
 * await context.waitForEvent("event-id", "1h");
 * await context.notify("event-id", data);
 * await context.call("step-id", { url: "...", method: "GET" });
 * ```
 */
