import { Hono } from "hono";
import { webhookReceiptWorkflow } from "../workflows/webhook-receipt";
import { connectionTeardownWorkflow } from "../workflows/connection-teardown";

const workflows = new Hono();

/**
 * POST /workflows/webhook-receipt
 *
 * Upstash Workflow calls back to this endpoint for each step execution.
 * The serve() handler manages QStash signature verification automatically.
 */
workflows.post("/webhook-receipt", webhookReceiptWorkflow);

/**
 * POST /workflows/connection-teardown
 *
 * Durable connection teardown. Triggered by DELETE /connections/:provider/:id.
 * Steps: revoke token, deregister webhook, clean cache, soft-delete DB records.
 */
workflows.post("/connection-teardown", connectionTeardownWorkflow);

export { workflows };
