import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Environment configuration for V2 Event-Driven Architecture
 * This validates required environment variables for the event system
 */
export const env = createEnv({
	server: {
		// Redis Configuration (Required for streaming and state management)
		KV_REST_API_URL: z.string().url().describe("Upstash Redis REST API URL"),
		KV_REST_API_TOKEN: z.string().min(1).describe("Upstash Redis REST API token"),

		// Qstash Event System (Required for event-driven architecture)
		QSTASH_URL: z.string().url().describe("Qstash API URL"),
		QSTASH_TOKEN: z.string().min(1).describe("Qstash authentication token"),

		// QStash signing keys for signature verification
		QSTASH_CURRENT_SIGNING_KEY: z
			.string()
			.min(1)
			.optional()
			.describe("QStash current signing key for signature verification"),
		QSTASH_NEXT_SIGNING_KEY: z
			.string()
			.min(1)
			.optional()
			.describe("QStash next signing key for signature verification"),

		// AI Gateway (Required for LLM calls)
		AI_GATEWAY_API_KEY: z.string().min(1).describe("Vercel AI Gateway API key"),

		// Optional: Timeouts and limits
		AGENT_MAX_ITERATIONS: z.coerce.number().min(1).max(100).default(10).optional(),
		TOOL_EXECUTION_TIMEOUT: z.coerce.number().min(1000).max(300000).default(30000).optional(),
		STREAM_TTL_SECONDS: z.coerce.number().min(60).max(86400).default(3600).optional(),
	},

	runtimeEnv: {
		// These will be provided by the consuming application
		KV_REST_API_URL: process.env.KV_REST_API_URL,
		KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
		QSTASH_URL: process.env.QSTASH_URL,
		QSTASH_TOKEN: process.env.QSTASH_TOKEN,
		QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
		QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
		AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
		AGENT_MAX_ITERATIONS: process.env.AGENT_MAX_ITERATIONS,
		TOOL_EXECUTION_TIMEOUT: process.env.TOOL_EXECUTION_TIMEOUT,
		STREAM_TTL_SECONDS: process.env.STREAM_TTL_SECONDS,
	},

	/**
	 * Skip validation in certain environments
	 */
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,

	/**
	 * Empty strings are undefined
	 */
	emptyStringAsUndefined: true,
});

/**
 * Helper to get Redis client config
 */
export function getRedisConfig() {
	return {
		url: env.KV_REST_API_URL,
		token: env.KV_REST_API_TOKEN,
	};
}

/**
 * Helper to get Qstash client config
 */
export function getQstashConfig() {
	return {
		qstashUrl: env.QSTASH_URL,
		qstashToken: env.QSTASH_TOKEN,
	};
}

/**
 * Helper to get system limits
 */
export function getSystemLimits() {
	return {
		agentMaxIterations: env.AGENT_MAX_ITERATIONS ?? 10,
		toolExecutionTimeout: env.TOOL_EXECUTION_TIMEOUT ?? 30000,
		streamTTLSeconds: env.STREAM_TTL_SECONDS ?? 3600,
	};
}
