import { Hono } from "hono";

import { healthCheckHandler } from "./handlers/health-check-handler.js";
import { pingHandler } from "./handlers/ping-handler.js";

// Create health router
const healthRouter = new Hono();

// Map multiple endpoints to the same health check handler
healthRouter.get("/", healthCheckHandler);
healthRouter.get("/ping", pingHandler);

export default healthRouter;
