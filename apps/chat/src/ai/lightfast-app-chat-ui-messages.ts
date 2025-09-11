import type { RuntimeContext } from "lightfast/server/adapters/types";
import type { InferUITools, UIMessage } from "ai";
import type { webSearchTool } from "~/ai/tools/web-search";
import type { createDocumentTool } from "~/ai/tools/create-document";
import type { AppRuntimeContext } from "~/ai/types";

// Custom data types for artifact streaming - type definitions without 'data-' prefix
// But actual streaming always uses 'data-' prefix in type field
export interface LightfastAppChatUICustomDataTypes {
	"kind": string;
	"id": string;
	"title": string;
	"clear": null;
	"finish": null;
	"codeDelta": string;
}

// Helper type to extract the tool type from a tool factory function
// This handles the RuntimeContext injection pattern
type ExtractToolType<T> = T extends (context: RuntimeContext<AppRuntimeContext>) => infer R ? R : never;

// Define the tool set type using the helper
// This matches the structure passed to streamText() in route.ts
export type LightfastAppChatToolSet = InferUITools<{
	webSearch: ExtractToolType<typeof webSearchTool>;
	createDocument: ExtractToolType<typeof createDocumentTool>;
}>;

// Metadata type for our messages
export interface LightfastAppChatUIMessageMetadata {
	createdAt?: string;
	sessionId?: string;
	resourceId?: string;
	modelId?: string; // The AI model used for assistant messages
}

// Main UIMessage type with our custom generics
export type LightfastAppChatUIMessage = UIMessage<LightfastAppChatUIMessageMetadata, LightfastAppChatUICustomDataTypes, LightfastAppChatToolSet>;

// Helper type for message parts
export type LightfastAppChatUIMessagePart = LightfastAppChatUIMessage["parts"][number];

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

// Utility type to extract tool names
export type LightfastAppChatToolName = keyof LightfastAppChatToolSet;

// Utility type to get input for a specific tool
export type LightfastAppChatToolInput<T extends LightfastAppChatToolName> = LightfastAppChatToolSet[T]["input"];

// Specific typed ToolUIPart definitions for our tools
export type CreateDocumentToolUIPart = Extract<
	LightfastAppChatUIMessagePart,
	{ type: "tool-createDocument" }
>;

export type WebSearchToolUIPart = Extract<
	LightfastAppChatUIMessagePart,
	{ type: "tool-webSearch" }
>;