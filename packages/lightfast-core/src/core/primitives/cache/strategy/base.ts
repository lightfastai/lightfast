import type { CoreMessage } from "ai";

/**
 * Result of running a cache strategy
 */
export interface CacheStrategyResult {
	/**
	 * Array of message indices that should be cached
	 */
	messageIndicesToCache: number[];
}

/**
 * Base interface for cache strategies
 * Each strategy implements its own distinct caching logic
 */
export interface CacheStrategy {
	/**
	 * Run the caching strategy and return which messages should be cached
	 */
	run(messages: CoreMessage[]): CacheStrategyResult;
}
