import { serve as upstashServe } from "@upstash/workflow/hono";
import type { Context } from "hono";
import type { WorkflowContext, WorkflowHandler } from "./types";

/**
 * Create a Hono route handler for a workflow
 *
 * This wraps the Upstash Workflow Hono adapter with logging and type safety.
 * Returns a Hono route handler `(ctx: Context) => Promise<Response>` that can
 * be mounted directly on a Hono app.
 *
 * @example
 * ```typescript
 * // src/routes/workflows.ts
 * import { serve } from "@vendor/upstash-workflow/hono";
 *
 * const myWorkflow = serve<MyPayload>(async (context) => {
 *   const result = await context.run("step-1", async () => {
 *     return processData(context.requestPayload);
 *   });
 * });
 *
 * // In your Hono app:
 * app.post("/workflows/my-workflow", myWorkflow);
 * ```
 */
export function serve<TPayload = unknown>(
  handler: WorkflowHandler<TPayload>,
  options?: {
    /**
     * Enable verbose logging
     */
    verbose?: boolean;

    /**
     * Disable telemetry
     */
    disableTelemetry?: boolean;

    /**
     * Parse raw string payload into typed object
     */
    initialPayloadParser?: (raw: string) => TPayload;

    /**
     * Called when QStash delivers failure notification after all retries
     */
    failureFunction?: (params: {
      context: unknown;
      failStatus: number;
      failResponse: string;
    }) => Promise<void>;
  },
): (ctx: Context) => Promise<Response> {
  const wrappedHandler = async (context: WorkflowContext<TPayload>) => {
    try {
      if (options?.verbose) {
        const payload = context.requestPayload;
        console.log("[Workflow] Starting workflow execution", {
          payloadType: typeof payload,
          payloadKeys:
            typeof payload === "object" && payload !== null
              ? Object.keys(payload)
              : undefined,
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
    ...(options?.initialPayloadParser && {
      initialPayloadParser: options.initialPayloadParser,
    }),
    ...(options?.failureFunction && {
      failureFunction: options.failureFunction,
    }),
  });
}
