import type { UIMessage } from "ai";
import type { LightfastAppChatToolSet } from "./tool-set";

// Custom data types for artifact streaming - type definitions without 'data-' prefix
// But actual streaming always uses 'data-' prefix in type field
export interface LightfastAppChatUICustomDataTypes {
	"kind": string;
	"id": string;
	"title": string;
	"clear": null;
	"finish": null;
	"codeDelta": string;
	"diagramDelta": string;
	// Index signature to satisfy UIDataTypes constraint
	[key: string]: unknown;
}

// Metadata type for our messages
export interface LightfastAppChatUIMessageMetadata {
	createdAt?: string;
	sessionId?: string;
	resourceId?: string;
	modelId?: string; // The AI model used for assistant messages
}

// Main UIMessage type with our custom generics
export type LightfastAppChatUIMessage = UIMessage<
	LightfastAppChatUIMessageMetadata, 
	LightfastAppChatUICustomDataTypes, 
	LightfastAppChatToolSet
>;

// Helper type for message parts
export type LightfastAppChatUIMessagePart = LightfastAppChatUIMessage["parts"][number];

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