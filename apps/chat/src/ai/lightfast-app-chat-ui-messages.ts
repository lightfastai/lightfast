// Re-export types from separate files for cleaner architecture
export type { AppRuntimeContext } from "./types/app-runtime-context";
export type { LightfastAppChatToolSet } from "./types/tool-set";
export type {
	LightfastAppChatUIMessage,
	LightfastAppChatUIMessagePart,
	LightfastAppChatUICustomDataTypes,
	LightfastAppChatUIMessageMetadata,
	LightfastAppChatToolName,
	LightfastAppChatToolInput,
	CreateDocumentToolUIPart,
	WebSearchToolUIPart,
} from "./types/ui-message-types";

/**
 * Context passed through fetchRequestHandler to memory operations
 * Allows tracking model usage and other metadata
 */
export interface ChatFetchContext {
	modelId: string;
	isAnonymous: boolean;
}

// Agent types
export type AgentId = "c010";

// Type guards for message parts - re-import the types for local use
import type { LightfastAppChatUIMessagePart } from "./types/ui-message-types";

// Type guards for specific part types
export function isTextPart(part: LightfastAppChatUIMessagePart): part is Extract<LightfastAppChatUIMessagePart, { type: "text" }> {
	return part.type === "text";
}

export function isReasoningPart(
	part: LightfastAppChatUIMessagePart,
): part is Extract<LightfastAppChatUIMessagePart, { type: "reasoning" }> {
	return part.type === "reasoning";
}

export function isToolPart(part: LightfastAppChatUIMessagePart): boolean {
	return typeof part.type === "string" && part.type.startsWith("tool-");
}