import type { UIMessage } from "ai";

// Custom data types for message parts (empty for now)
export interface LightfastUICustomDataTypes {
	[key: string]: unknown; // Index signature required by UIDataTypes
}

// Tool schemas - simplified generic type
export type LightfastToolSchemas = Record<
	string,
	{
		input: unknown;
		output: unknown;
	}
>;

// Metadata type for our messages
export interface LightfastUIMessageMetadata {
	createdAt?: string;
	threadId?: string;
	resourceId?: string;
	status?: "thinking" | "streaming" | "done";
}

// Main UIMessage type with our custom generics
export type LightfastUIMessage = UIMessage<
	LightfastUIMessageMetadata,
	LightfastUICustomDataTypes,
	LightfastToolSchemas
>;

// Type for the parts in Mastra messages (simplified for now)
export interface MastraMessagePart {
	type: string;
	text?: string;
	state?: string;
	[key: string]: unknown;
}

// Mastra memory message type (what we actually receive from memory.query().uiMessages)
export interface MastraUIMessage {
	id: string;
	role: "user" | "assistant" | "system";
	parts: MastraMessagePart[];
	metadata?: {
		createdAt: string; // ISO string date
		threadId: string;
		resourceId: string;
	};
}

// Helper type for message parts
export type LightfastUIMessagePart = LightfastUIMessage["parts"][number];

// Type guards for specific part types
export function isTextPart(part: LightfastUIMessagePart): part is Extract<LightfastUIMessagePart, { type: "text" }> {
	return part.type === "text";
}

export function isToolPart(part: LightfastUIMessagePart): boolean {
	return typeof part.type === "string" && part.type.startsWith("tool-");
}

// Utility type to extract tool names
export type LightfastToolName = keyof LightfastToolSchemas;

// Utility type to get input for a specific tool
export type LightfastToolInput<T extends LightfastToolName> = LightfastToolSchemas[T]["input"];
