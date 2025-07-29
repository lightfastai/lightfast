/**
 * V2 Test Server Configuration
 * Direct instantiation of infrastructure components
 */

import { EventEmitter, StreamConsumer, StreamGenerator } from "@lightfast/ai/v2/core";
import { Redis } from "@upstash/redis";

// Get base URL for the test server
function getBaseUrl(): string {
	return process.env.WORKER_BASE_URL || `http://localhost:${process.env.PORT || 8080}`;
}

// Create Redis client instance
export const redis = new Redis({
	url: process.env.KV_REST_API_URL!,
	token: process.env.KV_REST_API_TOKEN!,
});

// Create event emitter instance
// The EventEmitter internally maps event types to worker paths
export const eventEmitter = new EventEmitter({
	qstashUrl: process.env.QSTASH_URL || "https://qstash.upstash.io",
	qstashToken: process.env.QSTASH_TOKEN!,
	baseUrl: getBaseUrl(),
	retryConfig: {
		retries: 3,
		backoff: "exponential",
	},
});

// Create stream generator instance
export const streamGenerator = new StreamGenerator(redis);

// Create stream consumer instance
export const streamConsumer = new StreamConsumer(redis);

// System limits configuration
export const SYSTEM_LIMITS = {
	agentMaxIterations: Number(process.env.AGENT_MAX_ITERATIONS) || 10,
	toolExecutionTimeout: Number(process.env.TOOL_EXECUTION_TIMEOUT) || 30000,
	streamTTLSeconds: Number(process.env.STREAM_TTL_SECONDS) || 3600,
};
