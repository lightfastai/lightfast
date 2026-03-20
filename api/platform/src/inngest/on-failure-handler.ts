/**
 * Neural Workflow onFailure Handler Factory
 *
 * Neural workflows share a common failure handling pattern:
 * 1. Extract the original event from Inngest's FailureEventPayload (event.data.event)
 * 2. Log the error with workflow-specific context fields
 * 3. Locate the job by inngestRunId and mark it as failed
 *
 * This factory encapsulates that boilerplate so each workflow only
 * declares what makes it unique: log message, context fields, output shape.
 *
 * @example
 * ```ts
 * onFailure: createNeuralOnFailureHandler(
 *   "memory/event.capture",
 *   {
 *     logMessage: "Event capture failed",
 *     logContext: ({ workspaceId, sourceEvent }) => ({ workspaceId, sourceId: sourceEvent.sourceId }),
 *     buildOutput: ({ data: { sourceEvent }, error }) => ({
 *       inngestFunctionId: "event.capture",
 *       status: "failure",
 *       sourceId: sourceEvent.sourceId,
 *       error,
 *     }),
 *   }
 * ),
 * ```
 */

import type {
  NeuralFailureOutput,
  WorkflowOutput,
} from "@repo/app-validation";
import { log } from "@vendor/observability/log/next";
import { completeJob, getJobByInngestRunId } from "../lib/jobs";
import type { Events } from "./client";

/**
 * Creates a consistent onFailure handler for neural Inngest workflows.
 *
 * @param _eventName - Event name used only for TypeScript generic inference.
 *   The `_` prefix signals intentional non-use at runtime.
 */
export function createNeuralOnFailureHandler<TEventName extends keyof Events>(
  _eventName: TEventName,
  config?: {
    logMessage: string;
    /** Returns loggable fields derived from the original event's data */
    logContext: (data: Events[TEventName]["data"]) => Record<string, unknown>;
    /** Constructs the failure output stored in the job record */
    buildOutput: (params: {
      data: Events[TEventName]["data"];
      error: string;
    }) => NeuralFailureOutput;
  }
) {
  return async ({
    event,
    error,
  }: {
    // Inngest's FailureEventPayload wraps the original event under data.event.
    // The exact FailureEventPayload generic shape is an Inngest internal —
    // the cast below re-establishes type safety.
    event: { data: { event: unknown } };
    error: Error;
  }) => {
    const originalEvent = event.data.event as {
      id: string;
      data: Events[TEventName]["data"];
    };
    const data = originalEvent.data;
    const eventId = originalEvent.id;

    log.error(config?.logMessage ?? `${String(_eventName)} failed`, {
      ...(config?.logContext(data) ?? {}),
      error: error.message,
    });

    if (config && eventId) {
      const job = await getJobByInngestRunId(eventId);
      if (job) {
        await completeJob({
          jobId: job.id,
          status: "failed",
          // NeuralFailureOutput's .catchall(z.unknown()) index signature is
          // structurally incompatible with Drizzle's WorkflowOutput column type.
          // The cast is safe: each workflow's buildOutput validates via satisfies.
          output: config.buildOutput({
            data,
            error: error.message,
          }) as unknown as WorkflowOutput,
        });
      }
    }
  };
}
