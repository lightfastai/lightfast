/**
 * Health check routes that don't require Redis
 */

import { Hono } from "hono";

const healthRoutes = new Hono();

// GET /health - Basic health check
healthRoutes.get("/", (c) => {
	return c.json({
		status: "ok",
		timestamp: new Date().toISOString(),
		environment: {
			hasRedisUrl: !!process.env.KV_REST_API_URL,
			hasRedisToken: !!process.env.KV_REST_API_TOKEN,
			hasQstashToken: !!process.env.QSTASH_TOKEN,
			hasAIGatewayKey: !!process.env.AI_GATEWAY_API_KEY,
		},
	});
});

// GET /health/env - Show environment status (debug)
healthRoutes.get("/env", (c) => {
	return c.json({
		status: "ok",
		environment: {
			KV_REST_API_URL: process.env.KV_REST_API_URL ? "Set" : "Not set",
			KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN ? "Set" : "Not set",
			QSTASH_TOKEN: process.env.QSTASH_TOKEN ? "Set" : "Not set",
			AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY ? "Set" : "Not set",
			PORT: process.env.PORT || "8080",
		},
	});
});

export { healthRoutes };