import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Environment configuration for V2 Event-Driven Architecture
 * This validates required environment variables for the event system
 */
export const env = createEnv({
	/**
	 * Server-side environment variables schema
	 */
	server: {
		// Redis Configuration (Required for streaming and state management)
		KV_REST_API_URL: z.string().url().describe("Upstash Redis REST API URL"),
		KV_REST_API_TOKEN: z.string().min(1).describe("Upstash Redis REST API token"),

		// Qstash Event System (Required for event-driven architecture)
		QSTASH_URL: z.string().url().default("https://qstash.upstash.io").describe("Qstash API URL"),
		QSTASH_TOKEN: z.string().min(1).describe("Qstash authentication token"),

		// AI Gateway (Required for LLM calls)
		AI_GATEWAY_API_KEY: z.string().min(1).describe("Vercel AI Gateway API key"),

		// Optional: Override default topic prefix
		QSTASH_TOPIC_PREFIX: z.string().default("agent").optional().describe("Qstash topic prefix for events"),

		// Optional: Worker URLs (for local development)
		AGENT_LOOP_WORKER_URL: z.string().url().optional().describe("URL for agent loop worker"),
		TOOL_EXECUTOR_URL: z.string().url().optional().describe("URL for tool executor worker"),

		// Optional: Timeouts and limits
		AGENT_MAX_ITERATIONS: z.coerce.number().min(1).max(100).default(10).optional(),
		TOOL_EXECUTION_TIMEOUT: z.coerce.number().min(1000).max(300000).default(30000).optional(),
		STREAM_TTL_SECONDS: z.coerce.number().min(60).max(86400).default(3600).optional(),
	},

	/**
	 * Runtime environment variables
	 */
	runtimeEnv: {
		// Redis
		KV_REST_API_URL: process.env.KV_REST_API_URL,
		KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,

		// Qstash
		QSTASH_URL: process.env.QSTASH_URL,
		QSTASH_TOKEN: process.env.QSTASH_TOKEN,
		QSTASH_TOPIC_PREFIX: process.env.QSTASH_TOPIC_PREFIX,

		// AI Gateway
		AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,

		// Worker URLs
		AGENT_LOOP_WORKER_URL: process.env.AGENT_LOOP_WORKER_URL,
		TOOL_EXECUTOR_URL: process.env.TOOL_EXECUTOR_URL,

		// Limits
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
		topicPrefix: env.QSTASH_TOPIC_PREFIX,
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
