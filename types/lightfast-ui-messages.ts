import type { UIMessage } from "ai";
import type { ExperimentalAgentToolSchemas } from "@/mastra/agents/experimental";

// Custom data types for message parts (empty for now)
export interface LightfastUICustomDataTypes {
	[key: string]: unknown; // Index signature required by UIDataTypes
}

// Tool schemas extracted from all experimental agents (a010, a011, etc.)
export type LightfastToolSchemas = ExperimentalAgentToolSchemas;

// Main UIMessage type with our custom generics
export type LightfastUIMessage = UIMessage<
	Record<string, never>, // No custom metadata needed
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
