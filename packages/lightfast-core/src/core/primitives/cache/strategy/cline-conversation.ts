import type { CoreMessage } from "ai";
import type { CacheStrategy, CacheStrategyResult } from "./base";

export interface ClineConversationStrategyConfig {
	/**
	 * Whether to always cache the system prompt
	 * @default true
	 */
	cacheSystemPrompt?: boolean;
	/**
	 * Number of recent user messages to cache as breakpoints
	 * @default 2
	 */
	recentUserMessagesToCache?: number;
}

/**
 * Cline-inspired caching strategy for Anthropic
 *
 * Based on Cline AI assistant's proven approach:
 * 1. Always cache system prompt (biggest efficiency gain)
 * 2. Cache last 2 user messages only (strategic conversation breakpoints)
 * 3. Works perfectly with thinking models
 *
 * This approach maximizes cache hits while staying within Anthropic's
 * 4 breakpoint limit and ensuring compatibility with thinking mode.
 */
export class ClineConversationStrategy implements CacheStrategy {
	private cacheSystemPrompt: boolean;
	private recentUserMessagesToCache: number;

	constructor(config: ClineConversationStrategyConfig = {}) {
		this.cacheSystemPrompt = config.cacheSystemPrompt ?? true;
		this.recentUserMessagesToCache = config.recentUserMessagesToCache ?? 2;
	}

	/**
	 * Run Cline's caching strategy
	 * 1. Always cache system prompt (biggest efficiency gain, works with thinking)
	 * 2. Cache last N user messages only (strategic conversation breakpoints)
	 */
	run(messages: CoreMessage[]): CacheStrategyResult {
		// Find all user message indices
		const userMessageIndices = messages.reduce(
			(acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
			[] as number[],
		);

		// Get the last N user message indices to cache
		const messageIndicesToCache = userMessageIndices.slice(
			-this.recentUserMessagesToCache,
		);

		return {
			messageIndicesToCache,
		};
	}
}
