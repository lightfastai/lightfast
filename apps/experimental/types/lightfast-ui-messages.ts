import type { RuntimeContext } from "@lightfast/ai/agent/server/adapters/types";
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
} from "@/app/ai/tools";
import type { AppRuntimeContext } from "@/app/ai/types";

// Custom data types for message parts (empty for now)
export interface LightfastUICustomDataTypes {
	[key: string]: unknown; // Index signature required by UIDataTypes
}

// Helper type to extract the tool type from a tool factory function
// This handles the RuntimeContext injection pattern
type ExtractToolType<T> = T extends (context: RuntimeContext<AppRuntimeContext>) => infer R ? R : never;

// Define the tool set type using the helper
// This matches the structure passed to streamText() in route.ts
export type LightfastToolSet = {
	fileWrite: InferUITool<ExtractToolType<typeof fileWriteTool>>;
	fileRead: InferUITool<ExtractToolType<typeof fileReadTool>>;
	fileDelete: InferUITool<ExtractToolType<typeof fileDeleteTool>>;
	fileStringReplace: InferUITool<ExtractToolType<typeof fileStringReplaceTool>>;
	fileFindInContent: InferUITool<ExtractToolType<typeof fileFindInContentTool>>;
	fileFindByName: InferUITool<ExtractToolType<typeof fileFindByNameTool>>;
	webSearch: InferUITool<ExtractToolType<typeof webSearchTool>>;
	createSandbox: InferUITool<ExtractToolType<typeof createSandboxTool>>;
	executeSandboxCommand: InferUITool<ExtractToolType<typeof executeSandboxCommandTool>>;
	createSandboxWithPorts: InferUITool<ExtractToolType<typeof createSandboxWithPortsTool>>;
	getSandboxDomain: InferUITool<ExtractToolType<typeof getSandboxDomainTool>>;
	listSandboxRoutes: InferUITool<ExtractToolType<typeof listSandboxRoutesTool>>;
	todoWrite: InferUITool<ExtractToolType<typeof todoWriteTool>>;
	todoRead: InferUITool<ExtractToolType<typeof todoReadTool>>;
	todoClear: InferUITool<ExtractToolType<typeof todoClearTool>>;
};

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
