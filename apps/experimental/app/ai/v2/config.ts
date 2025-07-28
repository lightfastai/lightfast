/**
 * V2 AI Infrastructure Configuration
 * Centralized configuration for all V2 AI components
 */

import { Redis } from "@upstash/redis";
import { EventEmitter, EventType, StreamGenerator, StreamConsumer } from "@lightfast/ai/v2/core";
import { env } from "@/env";

/**
 * Get the base URL for the application
 */
function getBaseUrl(): string {
	// In browser context
	if (typeof window !== "undefined") {
		return window.location.origin;
	}

	// Vercel deployment
	if (process.env.VERCEL_URL) {
		return `https://${process.env.VERCEL_URL}`;
	}

	// Vercel preview deployments
	if (process.env.VERCEL_BRANCH_URL) {
		return `https://${process.env.VERCEL_BRANCH_URL}`;
	}

	// Production domain (if set)
	if (process.env.NEXT_PUBLIC_VERCEL_URL) {
		return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
	}

	// Local development
	return `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * Worker endpoint configuration
 * Maps event types to their handler endpoints
 */
export const WORKER_ENDPOINTS: Record<string, string> = {
	[EventType.AGENT_LOOP_INIT]: "/api/v2/workers/agent-loop",
	[EventType.AGENT_TOOL_CALL]: "/api/v2/workers/tool-executor",
	[EventType.TOOL_EXECUTION_COMPLETE]: "/api/v2/workers/tool-result-complete",
	[EventType.TOOL_EXECUTION_FAILED]: "/api/v2/workers/tool-result-failed",
	[EventType.AGENT_LOOP_COMPLETE]: "/api/v2/workers/agent-complete",
};

/**
 * Create Redis client instance
 */
export const redis = new Redis({
	url: env.KV_REST_API_URL,
	token: env.KV_REST_API_TOKEN,
});

/**
 * Create event emitter instance with full configuration
 */
export const eventEmitter = new EventEmitter({
	qstashUrl: env.QSTASH_URL,
	qstashToken: env.QSTASH_TOKEN,
	baseUrl: getBaseUrl(),
	endpoints: WORKER_ENDPOINTS,
	retryConfig: {
		retries: 3,
		backoff: "exponential",
	},
});

/**
 * Create stream generator instance
 */
export const streamGenerator = new StreamGenerator(redis);

/**
 * Create stream consumer instance
 */
export const streamConsumer = new StreamConsumer(redis);

/**
 * System limits configuration
 */
export const SYSTEM_LIMITS = {
	agentMaxIterations: Number(env.AGENT_MAX_ITERATIONS) || 10,
	toolExecutionTimeout: Number(env.TOOL_EXECUTION_TIMEOUT) || 30000,
	streamTTLSeconds: Number(env.STREAM_TTL_SECONDS) || 3600,
};

/**
 * Get all V2 infrastructure components
 */
export function getV2Infrastructure() {
	return {
		redis,
		eventEmitter,
		streamGenerator,
		streamConsumer,
		limits: SYSTEM_LIMITS,
	};
}