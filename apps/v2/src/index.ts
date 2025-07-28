/**
 * V2 Event-Driven Architecture Testing Server
 * A lightweight Hono server for testing the event-driven agent system
 */

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { eventRoutes } from "./routes/events";
import { healthRoutes } from "./routes/health";
import { initRoutes } from "./routes/init";
import { streamRoutes } from "./routes/stream";
import { testRoutes } from "./routes/test";
import { workerRoutes } from "./routes/workers";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());

// Health check
app.get("/", (c) => {
	return c.json({
		status: "ok",
		service: "v2-event-driven-architecture",
		timestamp: new Date().toISOString(),
		endpoints: {
			init: "/init",
			stream: "/stream/:sessionId",
			events: "/events",
			workers: "/workers",
			test: "/test",
		},
	});
});

// Mount routes
app.route("/health", healthRoutes);
app.route("/init", initRoutes);
app.route("/stream", streamRoutes);
app.route("/events", eventRoutes);
app.route("/workers", workerRoutes);
app.route("/test", testRoutes);

// Error handling
app.onError((err, c) => {
	console.error(`Error: ${err.message}`, err);
	return c.json(
		{
			error: err.message,
			timestamp: new Date().toISOString(),
		},
		500,
	);
});

// Start server
const port = Number(process.env.PORT) || 8090;

serve({
	fetch: app.fetch,
	port,
});

console.log(`🚀 V2 Event-Driven Architecture server running on http://localhost:${port}`);
console.log(`
Available endpoints:
- GET  /                     - Health check
- POST /init                 - Initialize agent session
- GET  /stream/:sessionId    - SSE stream for session
- POST /events/emit          - Manually emit events
- GET  /events/list          - List recent events
- POST /workers/agent-loop   - Agent loop worker endpoint
- POST /workers/tool-executor - Tool executor endpoint
- GET  /test                 - List test scenarios
- POST /test/:scenario       - Run test scenario
`);
