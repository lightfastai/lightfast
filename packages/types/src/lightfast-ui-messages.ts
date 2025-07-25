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

// Define the tool set type using InferUITool for each tool
// This matches the structure passed to streamText() in route.ts
export type LightfastToolSet = {
	file: InferUITool<ReturnType<typeof fileTool>>;
	fileRead: InferUITool<ReturnType<typeof fileReadTool>>;
	fileDelete: InferUITool<ReturnType<typeof fileDeleteTool>>;
	fileStringReplace: InferUITool<ReturnType<typeof fileStringReplaceTool>>;
	fileFindInContent: InferUITool<ReturnType<typeof fileFindInContentTool>>;
	fileFindByName: InferUITool<ReturnType<typeof fileFindByNameTool>>;
	webSearch: InferUITool<ReturnType<typeof webSearchTool>>;
	createSandbox: InferUITool<ReturnType<typeof createSandboxTool>>;
	executeSandboxCommand: InferUITool<ReturnType<typeof executeSandboxCommandTool>>;
	createSandboxWithPorts: InferUITool<ReturnType<typeof createSandboxWithPortsTool>>;
	getSandboxDomain: InferUITool<ReturnType<typeof getSandboxDomainTool>>;
	listSandboxRoutes: InferUITool<ReturnType<typeof listSandboxRoutesTool>>;
	todoWrite: InferUITool<ReturnType<typeof todoWriteTool>>;
	todoRead: InferUITool<ReturnType<typeof todoReadTool>>;
	todoClear: InferUITool<ReturnType<typeof todoClearTool>>;
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

