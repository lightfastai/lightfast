import { Hono } from "hono";
import { connectionTeardownWorkflow } from "../workflows/connection-teardown";

const workflows = new Hono();

/**
 * POST /workflows/connection-teardown
 *
 * Durable connection teardown. Triggered by DELETE /connections/:provider/:id.
 * Steps: revoke token, deregister webhook, clean cache, soft-delete DB records.
 */
workflows.post("/connection-teardown", connectionTeardownWorkflow);

export { workflows };
