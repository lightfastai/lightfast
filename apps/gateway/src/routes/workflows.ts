import { Hono } from "hono";
import { webhookDeliveryWorkflow } from "../workflows/webhook-delivery";
import { connectionTeardownWorkflow } from "../workflows/connection-teardown";

const workflows = new Hono();

/**
 * POST /workflows/webhook-delivery
 *
 * Upstash Workflow calls back to this endpoint for each step execution.
 * The serve() handler manages QStash signature verification automatically.
 */
workflows.post("/webhook-delivery", webhookDeliveryWorkflow);

/**
 * POST /workflows/connection-teardown
 *
 * Durable connection teardown. Triggered by DELETE /connections/:provider/:id.
 * Steps: revoke token, deregister webhook, clean cache, soft-delete DB records.
 */
workflows.post("/connection-teardown", connectionTeardownWorkflow);

export { workflows };
