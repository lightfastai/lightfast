import type { RuntimeContext } from "@lightfastai/core/agent/server/adapters/types";
import type { InferUITools, UIMessage } from "ai";
import type { webSearchTool } from "~/ai/tools/web-search";
import type { AppRuntimeContext } from "~/ai/types";

// Custom data types for message parts (empty for now)
export type LightfastAppChatUICustomDataTypes = Record<string, unknown>;

// Helper type to extract the tool type from a tool factory function
// This handles the RuntimeContext injection pattern
type ExtractToolType<T> = T extends (context: RuntimeContext<AppRuntimeContext>) => infer R ? R : never;

// Define the tool set type using the helper
// This matches the structure passed to streamText() in route.ts
// Define the tool set type using InferUITools helper
export type LightfastAppChatToolSet = InferUITools<{
	webSearch: ExtractToolType<typeof webSearchTool>;
}>;

// Metadata type for our messages
export interface LightfastAppChatUIMessageMetadata {
	createdAt?: string;
	sessionId?: string;
	resourceId?: string;
	status?: "thinking" | "streaming" | "done";
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