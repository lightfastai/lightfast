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
 *   "apps-console/neural/cluster.check-summary",
 *   {
 *     logMessage: "Neural cluster summary failed",
 *     logContext: ({ workspaceId, clusterId }) => ({ workspaceId, clusterId }),
 *     buildOutput: ({ data: { clusterId }, error }) => ({
 *       inngestFunctionId: "neural.cluster.summary",
 *       status: "failure",
 *       clusterId,
 *       error,
 *     }),
 *   }
 * ),
 * ```
 */

import { log } from "@vendor/observability/log";
import { getJobByInngestRunId, completeJob } from "../../../lib/jobs";
import type { Events } from "../../client/client";

/** Base shape all neural workflow failure outputs must satisfy */
interface NeuralFailureOutput {
  inngestFunctionId: string;
  status: "failure";
  error: string;
  [key: string]: unknown;
}

/**
 * Creates a consistent onFailure handler for neural Inngest workflows.
 *
 * @param _eventName - Event name used only for TypeScript generic inference.
 *   The `_` prefix signals intentional non-use at runtime.
 */
export function createNeuralOnFailureHandler<TEventName extends keyof Events>(
  _eventName: TEventName,
  config: {
    logMessage: string;
    /** Returns loggable fields derived from the original event's data */
    logContext: (data: Events[TEventName]["data"]) => Record<string, unknown>;
    /** Constructs the failure output stored in the job record */
    buildOutput: (params: {
      data: Events[TEventName]["data"];
      error: string;
    }) => NeuralFailureOutput;
  },
) {
  return async ({
    event,
    error,
  }: {
    // Inngest's FailureEventPayload wraps the original event under data.event.
    // We use `any` here because the exact FailureEventPayload generic shape
    // is an Inngest internal — the cast below re-establishes type safety.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    event: { data: { event: any } };
    error: Error;
  }) => {
    const originalEvent = event.data.event as {
      id: string;
      data: Events[TEventName]["data"];
    };
    const data = originalEvent.data;
    const eventId = originalEvent.id;

    log.error(config.logMessage, {
      ...config.logContext(data),
      error: error.message,
    });

    if (eventId) {
      const job = await getJobByInngestRunId(eventId);
      if (job) {
        await completeJob({
          jobId: job.id,
          status: "failed",
          // `NeuralFailureOutput` is intentionally broad so the factory stays
          // generic. Type safety is enforced per-workflow via `satisfies` in
          // each `buildOutput` callback; the cast here is therefore safe.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
          output: config.buildOutput({ data, error: error.message }) as any,
        });
      }
    }
  };
}
