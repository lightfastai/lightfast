/**
 * Factory functions for creating V2 infrastructure components
 * with configuration from environment variables
 */

import { Redis } from "@upstash/redis";
import { getQstashConfig, getRedisConfig } from "./env";
import { createEventEmitter } from "./events/emitter";
import { StreamConsumer } from "./server/stream-consumer";
import { StreamGenerator } from "./server/stream-generator";

/**
 * Create a Redis client with default configuration
 */
export function createRedisClient(): Redis {
	const config = getRedisConfig();
	return new Redis(config);
}

/**
 * Create a stream generator with default configuration
 */
export function createStreamGenerator(redis?: Redis): StreamGenerator {
	const redisClient = redis || createRedisClient();
	return new StreamGenerator(redisClient);
}

/**
 * Create a stream consumer with default configuration
 */
export function createStreamConsumer(redis?: Redis): StreamConsumer {
	const redisClient = redis || createRedisClient();
	return new StreamConsumer(redisClient);
}

/**
 * Create an event emitter with default configuration
 */
export function createV2EventEmitter() {
	const config = getQstashConfig();
	return createEventEmitter(config);
}

/**
 * Create all V2 infrastructure components
 */
export function createV2Infrastructure() {
	const redis = createRedisClient();

	return {
		redis,
		streamGenerator: createStreamGenerator(redis),
		streamConsumer: createStreamConsumer(redis),
		eventEmitter: createV2EventEmitter(),
	};
}
