import type { UIMessage, UIMessageStreamWriter } from "ai";

/**
 * Business runtime context for tools and operations
 * 
 * NOTE: dataStream uses generic UIMessage to avoid circular dependency with specific message types.
 * In the future, when lightfast/core supports TMessage generics in createAgent,
 * this should be removed and handled by the framework via:
 * createAgent<LightfastAppChatUIMessage, AppRuntimeContext, typeof tools>()
 */
export interface AppRuntimeContext {
	userId?: string;
	agentId: string;
	messageId?: string;
	dataStream?: UIMessageStreamWriter<UIMessage>;
}