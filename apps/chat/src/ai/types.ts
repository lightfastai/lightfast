import type { UIMessageStreamWriter } from "ai";

export interface AppRuntimeContext {
	userId?: string;
	agentId: string;
	dataStream?: UIMessageStreamWriter; // For artifact streaming support
}

/**
 * Context passed through fetchRequestHandler to memory operations
 * Allows tracking model usage and other metadata
 */
export interface ChatFetchContext {
	modelId: string;
	isAnonymous: boolean;
}