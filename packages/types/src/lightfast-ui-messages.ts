import type { UIMessage, InferUITools } from "ai";
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

// Define the tool set type based on our actual tools - this represents the structure
// that matches what we pass to streamText() in the route
export type LightfastToolSet = {
	file: ReturnType<typeof fileTool>;
	fileRead: ReturnType<typeof fileReadTool>;
	fileDelete: ReturnType<typeof fileDeleteTool>;
	fileStringReplace: ReturnType<typeof fileStringReplaceTool>;
	fileFindInContent: ReturnType<typeof fileFindInContentTool>;
	fileFindByName: ReturnType<typeof fileFindByNameTool>;
	webSearch: ReturnType<typeof webSearchTool>;
	createSandbox: ReturnType<typeof createSandboxTool>;
	executeSandboxCommand: ReturnType<typeof executeSandboxCommandTool>;
	createSandboxWithPorts: ReturnType<typeof createSandboxWithPortsTool>;
	getSandboxDomain: ReturnType<typeof getSandboxDomainTool>;
	listSandboxRoutes: ReturnType<typeof listSandboxRoutesTool>;
	todoWrite: ReturnType<typeof todoWriteTool>;
	todoRead: ReturnType<typeof todoReadTool>;
	todoClear: ReturnType<typeof todoClearTool>;
};

// Properly infer tool schemas from our actual tools using AI SDK's utility
export type LightfastToolSchemas = InferUITools<LightfastToolSet>;

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
