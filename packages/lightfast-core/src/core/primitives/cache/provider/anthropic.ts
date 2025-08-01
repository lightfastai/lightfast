import type { CoreMessage, UIMessage } from "ai";
import type { CacheControl, ProviderCache } from "../base";
import type { CacheStrategy } from "../strategy/base";
import { ClineConversationStrategy } from "../strategy/cline-conversation";

export interface AnthropicCacheConfig {
	/**
	 * Caching strategy to use
	 * @default ClineConversationStrategy
	 */
	strategy?: CacheStrategy;
	/**
	 * Whether to enable cache control
	 * @default true
	 */
	enabled?: boolean;
}

/**
 * Anthropic-specific implementation of provider caching
 */
export class AnthropicProviderCache implements ProviderCache {
	private strategy: CacheStrategy;
	private enabled: boolean;

	constructor(config: AnthropicCacheConfig = {}) {
		this.strategy = config.strategy ?? new ClineConversationStrategy();
		this.enabled = config.enabled ?? true;
	}

	applySystemCaching(system: string): CoreMessage[] {
		if (!this.enabled) {
			return [
				{
					role: "system",
					content: system,
				},
			];
		}

		// For Cline strategy, always cache system prompt
		if (this.cacheSystemPrompt) {
			return [
				{
					role: "system",
					content: system,
					providerOptions: {
						anthropic: {
							cacheControl: { type: "ephemeral" },
						},
					},
				},
			];
		}

		return [
			{
				role: "system",
				content: system,
			},
		];
	}

	private get cacheSystemPrompt(): boolean {
		// For Cline strategy, always cache system prompt
		return true;
	}

	applyMessageCaching<TMessage extends UIMessage>(
		messages: CoreMessage[],
		originalMessages: TMessage[],
	): CoreMessage[] {
		if (!this.enabled) {
			return messages;
		}

		// Use strategy to determine which messages should be cached
		const strategyResult = this.strategy.run(messages);
		const indicesToCache = strategyResult.messageIndicesToCache;

		// Apply Anthropic-specific cache control to the specified messages
		return messages.map((message, index) => {
			if (indicesToCache.includes(index)) {
				return {
					...message,
					providerOptions: {
						anthropic: {
							cacheControl: { type: "ephemeral" },
						},
					},
				};
			}
			return message;
		});
	}
}

/**
 * Factory function for creating an Anthropic cache provider
 */
export function anthropicCache(config?: AnthropicCacheConfig): AnthropicProviderCache {
	return new AnthropicProviderCache(config);
}
