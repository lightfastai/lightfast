/**
 * V2 AI Infrastructure Configuration
 * Centralized configuration for all V2 AI components
 */

import { StreamConsumer } from "lightfast/v2/core";
import { Client as QStashClient } from "@upstash/qstash";
import { Redis } from "@upstash/redis";
import { env } from "@/env";

/**
 * Get the base URL for the application
 */
function getBaseUrl(): string {
	// Use production URL if available (for QStash to bypass preview auth)
	if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
	if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
	// eslint-disable-next-line no-restricted-properties
	return `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * Create Redis client instance
 */
export const redis = new Redis({
	url: env.KV_REST_API_URL,
	token: env.KV_REST_API_TOKEN,
});

/**
 * Create QStash client for worker communication
 * All events are routed through the unified handler at /api/v2/[...v]
 */
export const qstash = new QStashClient({
	token: env.QSTASH_TOKEN,
});

/**
 * Create stream consumer instance
 */
export const streamConsumer = new StreamConsumer(redis);

/**
 * Export base URL for handlers
 */
export const baseUrl = getBaseUrl();

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
		qstash,
		streamConsumer,
		baseUrl,
		limits: SYSTEM_LIMITS,
	};
}
