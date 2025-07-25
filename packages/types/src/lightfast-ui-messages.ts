import type { UIMessage, InferUITools, InferToolInput, InferToolOutput, InferUITool } from "ai";
import type {
	fileTool,
	fileReadTool,
	fileDeleteTool,
	fileStringReplaceTool,
	fileFindInContentTool,
	fileFindByNameTool,
	webSearchTool,
	createSandboxTool,
	executeSandboxCommandTool,
	createSandboxWithPortsTool,
	getSandboxDomainTool,
	listSandboxRoutesTool,
	todoWriteTool,
	todoReadTool,
	todoClearTool,
} from "@lightfast/ai/tools";
import type { RuntimeContext } from "@lightfast/ai/tools";

// Custom data types for message parts (empty for now)
export interface LightfastUICustomDataTypes {
	[key: string]: unknown; // Index signature required by UIDataTypes
}

// Helper type to extract the tool type from a tool factory function
// This handles the RuntimeContext injection pattern
type ExtractToolType<T> = T extends (context: RuntimeContext) => infer R ? R : never;

// Define the tool set type using the helper
// This matches the structure passed to streamText() in route.ts
export type LightfastToolSet = {
	file: InferUITool<ExtractToolType<typeof fileTool>>;
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
export type LightfastUIMessage = UIMessage<
	LightfastUIMessageMetadata,
	LightfastUICustomDataTypes,
	LightfastToolSet
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
export type LightfastToolName = keyof LightfastToolSet;

// Utility type to get input for a specific tool
export type LightfastToolInput<T extends LightfastToolName> = LightfastToolSet[T]["input"];

