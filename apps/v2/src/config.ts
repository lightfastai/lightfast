/**
 * V2 Test Server Configuration
 * Direct instantiation of infrastructure components
 */

import { StreamConsumer } from "@lightfast/ai/v2/core";
import { Client as QStashClient } from "@upstash/qstash";
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

// Create QStash client instance for worker communication
export const qstash = new QStashClient({
	token: process.env.QSTASH_TOKEN!,
});

// Create stream consumer instance
export const streamConsumer = new StreamConsumer(redis);

// Export base URL for use in handlers
export const baseUrl = getBaseUrl();

// System limits configuration
export const SYSTEM_LIMITS = {
	agentMaxIterations: Number(process.env.AGENT_MAX_ITERATIONS) || 10,
	toolExecutionTimeout: Number(process.env.TOOL_EXECUTION_TIMEOUT) || 30000,
	streamTTLSeconds: Number(process.env.STREAM_TTL_SECONDS) || 3600,
};
