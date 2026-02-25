import type { WorkflowContext } from "@upstash/workflow";

/**
 * Re-export core types from @upstash/workflow
 */
export type { WorkflowContext };

/**
 * Workflow configuration options
 */
export interface WorkflowConfig {
  /**
   * QStash token for authentication
   */
  token?: string;

  /**
   * Optional QStash endpoint URL
   * @default "https://qstash.upstash.io"
   */
  url?: string;

  /**
   * Enable verbose logging for debugging
   * @default false
   */
  verbose?: boolean;
}

/**
 * Workflow trigger options
 */
export interface WorkflowTriggerOptions<TPayload = unknown> {
  /**
   * Workflow endpoint URL (absolute URL)
   */
  url: string;

  /**
   * Payload to send to the workflow
   */
  body: TPayload;

  /**
   * Optional headers to include in the request
   */
  headers?: Record<string, string>;

  /**
   * Optional delay before starting workflow (in seconds)
   */
  delay?: number;

  /**
   * Optional workflow run ID for idempotency
   */
  workflowRunId?: string;
}

/**
 * Workflow trigger response
 */
export interface WorkflowTriggerResponse {
  /**
   * Unique ID for this workflow run
   */
  workflowRunId: string;

  /**
   * URL to check workflow status
   */
  url: string;
}

/**
 * Workflow step function
 */
export type WorkflowStep<TInput = unknown, TOutput = unknown> = (
  input: TInput,
) => Promise<TOutput>;

/**
 * Workflow handler function
 *
 * Generic `TPayload` flows into `WorkflowContext<TPayload>`, giving
 * `context.requestPayload` the concrete type at every call site.
 */
export type WorkflowHandler<TPayload = unknown> = (
  context: WorkflowContext<TPayload>,
) => Promise<void>;
