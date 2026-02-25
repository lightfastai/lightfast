import { Hono } from "hono";
import { webhookReceiptWorkflow } from "../workflows/webhook-receipt";

const workflows = new Hono();

/**
 * POST /workflows/webhook-receipt
 *
 * Upstash Workflow calls back to this endpoint for each step execution.
 * The serve() handler manages QStash signature verification automatically.
 */
workflows.post("/webhook-receipt", webhookReceiptWorkflow);

export { workflows };
