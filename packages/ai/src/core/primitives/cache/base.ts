import type { CoreMessage, UIMessage } from "ai";

/**
 * Cache control configuration for provider-specific caching
 */
export interface CacheControl {
	type: "ephemeral";
	ttl?: "5m" | "1h";
	[key: string]: any; // Allow additional properties for provider-specific options
}

/**
 * Base interface for provider-specific caching implementations
 */
export interface ProviderCache {
	/**
	 * Apply cache control to system messages
	 */
	applySystemCaching(system: string): CoreMessage[];

	/**
	 * Apply cache control to user messages based on provider-specific logic
	 */
	applyMessageCaching<TMessage extends UIMessage>(messages: CoreMessage[], originalMessages: TMessage[]): CoreMessage[];
}
