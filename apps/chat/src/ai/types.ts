import type { UIMessageStreamWriter } from "ai";
import type { LightfastAppChatUIMessage } from "./lightfast-app-chat-ui-messages";

export interface AppRuntimeContext {
	userId?: string;
	agentId: string;
	messageId?: string; // ID of the current assistant message being generated
	dataStream?: UIMessageStreamWriter<LightfastAppChatUIMessage>; // For artifact streaming support
}

/**
 * Context passed through fetchRequestHandler to memory operations
 * Allows tracking model usage and other metadata
 */
export interface ChatFetchContext {
	modelId: string;
	isAnonymous: boolean;
}