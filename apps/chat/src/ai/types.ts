export interface AppRuntimeContext {
	userId?: string;
	agentId: string;
}

/**
 * Context passed through fetchRequestHandler to memory operations
 * Allows tracking model usage and other metadata
 */
export interface ChatFetchContext {
	modelId: string;
	isAnonymous: boolean;
}