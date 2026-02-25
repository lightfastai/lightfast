import { Hono } from "hono";
import { webhookDeliveryWorkflow } from "../workflows/webhook-delivery";

const workflows = new Hono();

/**
 * POST /workflows/webhook-delivery
 *
 * Upstash Workflow calls back to this endpoint for each step execution.
 * The serve() handler manages QStash signature verification automatically.
 */
workflows.post("/webhook-delivery", webhookDeliveryWorkflow);

export { workflows };
