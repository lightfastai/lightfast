import { getWorkflowClient } from "@vendor/upstash-workflow/client";

/**
 * Singleton WorkflowClient for triggering Upstash Workflows from route handlers.
 *
 * Uses QStash credentials from the environment to schedule workflow executions.
 */
export const workflowClient = getWorkflowClient();
