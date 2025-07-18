import type { UIMessage } from "ai";
import type { V1AgentToolSchemas } from "./agent-tool-extraction";

// Custom data types for message parts (empty for now)
export interface LightfastUICustomDataTypes {
	[key: string]: any; // Index signature required by UIDataTypes
}

// Tool schemas extracted from V1Agent
export type LightfastToolSchemas = V1AgentToolSchemas;

// Main UIMessage type with our custom generics
export type LightfastUIMessage = UIMessage<
	{}, // No custom metadata needed
	LightfastUICustomDataTypes,
	LightfastToolSchemas
>;

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
