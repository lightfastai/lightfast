import { Client as UpstashWorkflowClient } from "@upstash/workflow";
import { env } from "../env";
import type {
  WorkflowConfig,
  WorkflowTriggerOptions,
  WorkflowTriggerResponse,
} from "./types";

/**
 * Workflow Client for triggering workflows
 *
 * @example
 * ```typescript
 * import { WorkflowClient } from "@vendor/upstash-workflow/client";
 *
 * const client = new WorkflowClient();
 *
 * const result = await client.trigger({
 *   url: "https://example.com/api/workflow",
 *   body: { foo: "bar" }
 * });
 * ```
 */
export class WorkflowClient {
  private client: UpstashWorkflowClient;
  private verbose: boolean;

  constructor(config?: WorkflowConfig) {
    const token = config?.token ?? env.QSTASH_TOKEN;
    const baseUrl = config?.url ?? env.QSTASH_URL;

    this.client = new UpstashWorkflowClient({
      token,
      ...(baseUrl && { baseUrl }),
    });

    this.verbose = config?.verbose ?? false;
  }

  /**
   * Trigger a workflow execution
   *
   * @param options - Workflow trigger options
   * @returns Workflow run ID and status URL
   */
  async trigger<TPayload = unknown>(
    options: WorkflowTriggerOptions<TPayload>,
  ): Promise<WorkflowTriggerResponse> {
    const { url, body, headers, delay, workflowRunId } = options;

    if (this.verbose) {
      console.log(`[Workflow] Triggering workflow: ${url}`, {
        body,
        headers,
        delay,
        workflowRunId,
      });
    }

    const result = await this.client.trigger({
      url,
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      ...(delay && { delay }),
      ...(workflowRunId && { workflowRunId }),
    });

    if (this.verbose) {
      console.log(`[Workflow] Triggered successfully:`, result);
    }

    return {
      workflowRunId: result.workflowRunId,
      url,
    };
  }

  /**
   * Cancel a workflow run
   *
   * @param workflowRunId - The workflow run ID to cancel
   */
  async cancel(workflowRunId: string): Promise<void> {
    if (this.verbose) {
      console.log(`[Workflow] Cancelling workflow: ${workflowRunId}`);
    }

    await this.client.cancel({ ids: workflowRunId });

    if (this.verbose) {
      console.log(`[Workflow] Cancelled successfully`);
    }
  }
}

/**
 * Create a singleton workflow client instance
 */
let clientInstance: WorkflowClient | null = null;

/**
 * Get or create the default workflow client
 *
 * @param config - Optional configuration
 * @returns WorkflowClient instance
 */
export function getWorkflowClient(config?: WorkflowConfig): WorkflowClient {
  clientInstance ??= new WorkflowClient(config);
  return clientInstance;
}
