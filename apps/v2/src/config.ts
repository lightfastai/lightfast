/**
 * V2 Test Server Configuration
 * Direct instantiation of infrastructure components
 */

import { Redis } from "@upstash/redis";
import { EventEmitter, EventTypes } from "@lightfast/ai/v2/core";
import { StreamGenerator, StreamConsumer } from "@lightfast/ai/v2/core";

// Get base URL for the test server
function getBaseUrl(): string {
	return process.env.WORKER_BASE_URL || `http://localhost:${process.env.PORT || 8080}`;
}

// Worker endpoint configuration
export const WORKER_ENDPOINTS: Record<string, string> = {
	[EventTypes.AGENT_LOOP_INIT]: "/workers/agent-loop",
	[EventTypes.AGENT_TOOL_CALL]: "/workers/tool-executor",
	[EventTypes.TOOL_EXECUTION_COMPLETE]: "/workers/tool-result-complete",
	[EventTypes.TOOL_EXECUTION_FAILED]: "/workers/tool-result-failed",
	[EventTypes.AGENT_LOOP_COMPLETE]: "/workers/agent-complete",
};

// Create Redis client instance
export const redis = new Redis({
	url: process.env.KV_REST_API_URL!,
	token: process.env.KV_REST_API_TOKEN!,
});

// Create event emitter instance
export const eventEmitter = new EventEmitter({
	qstashUrl: process.env.QSTASH_URL || "https://qstash.upstash.io",
	qstashToken: process.env.QSTASH_TOKEN!,
	baseUrl: getBaseUrl(),
	endpoints: WORKER_ENDPOINTS,
	retryConfig: {
		retries: 3,
		backoff: "exponential",
	},
});

// Create stream generator instance
export const streamGenerator = new StreamGenerator(redis);

// Create stream consumer instance
export const streamConsumer = new StreamConsumer(redis);