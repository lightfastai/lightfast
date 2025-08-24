import type { RuntimeContext } from "lightfast/server/adapters/types";
import type { InferToolInput, InferToolOutput, InferUITool, InferUITools, UIMessage } from "ai";
import type {
	createSandboxTool,
	createSandboxWithPortsTool,
	executeSandboxCommandTool,
	fileDeleteTool,
	fileFindByNameTool,
	fileFindInContentTool,
	fileReadTool,
	fileStringReplaceTool,
	fileWriteTool,
	getSandboxDomainTool,
	listSandboxRoutesTool,
	todoClearTool,
	todoReadTool,
	todoWriteTool,
	webSearchTool,
} from "@/app/(v1)/ai/tools";
import type { AppRuntimeContext } from "@/app/(v1)/ai/types";

// Custom data types for message parts (empty for now)
export type LightfastUICustomDataTypes = Record<string, unknown>;

// Helper type to extract the tool type from a tool factory function
// This handles the RuntimeContext injection pattern
type ExtractToolType<T> = T extends (context: RuntimeContext<AppRuntimeContext>) => infer R ? R : never;

// Define the tool set type using the helper
// This matches the structure passed to streamText() in route.ts
// Define the tool set type using InferUITools helper
export type LightfastToolSet = InferUITools<{
	fileWrite: ExtractToolType<typeof fileWriteTool>;
	fileRead: ExtractToolType<typeof fileReadTool>;
	fileDelete: ExtractToolType<typeof fileDeleteTool>;
	fileStringReplace: ExtractToolType<typeof fileStringReplaceTool>;
	fileFindInContent: ExtractToolType<typeof fileFindInContentTool>;
	fileFindByName: ExtractToolType<typeof fileFindByNameTool>;
	webSearch: ExtractToolType<typeof webSearchTool>;
	createSandbox: ExtractToolType<typeof createSandboxTool>;
	executeSandboxCommand: ExtractToolType<typeof executeSandboxCommandTool>;
	createSandboxWithPorts: ExtractToolType<typeof createSandboxWithPortsTool>;
	getSandboxDomain: ExtractToolType<typeof getSandboxDomainTool>;
	listSandboxRoutes: ExtractToolType<typeof listSandboxRoutesTool>;
	todoWrite: ExtractToolType<typeof todoWriteTool>;
	todoRead: ExtractToolType<typeof todoReadTool>;
	todoClear: ExtractToolType<typeof todoClearTool>;
}>;

// Metadata type for our messages
export interface LightfastUIMessageMetadata {
	createdAt?: string;
	threadId?: string;
	resourceId?: string;
	status?: "thinking" | "streaming" | "done";
}

// Main UIMessage type with our custom generics
export type LightfastUIMessage = UIMessage<LightfastUIMessageMetadata, LightfastUICustomDataTypes, LightfastToolSet>;

// Helper type for message parts
export type LightfastUIMessagePart = LightfastUIMessage["parts"][number];

// Type guards for specific part types
export function isTextPart(part: LightfastUIMessagePart): part is Extract<LightfastUIMessagePart, { type: "text" }> {
	return part.type === "text";
}

export function isReasoningPart(
	part: LightfastUIMessagePart,
): part is Extract<LightfastUIMessagePart, { type: "reasoning" }> {
	return part.type === "reasoning";
}

export function isToolPart(part: LightfastUIMessagePart): boolean {
	return typeof part.type === "string" && part.type.startsWith("tool-");
}

// Utility type to extract tool names
export type LightfastToolName = keyof LightfastToolSet;

// Utility type to get input for a specific tool
export type LightfastToolInput<T extends LightfastToolName> = LightfastToolSet[T]["input"];
