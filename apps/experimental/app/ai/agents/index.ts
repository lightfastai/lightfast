import { gateway } from "@ai-sdk/gateway";
import { Agent } from "@lightfast/ai/agent";
import type { RuntimeContext } from "@lightfast/ai/agent/server/adapters/types";
import { smoothStream, stepCountIs } from "ai";
import type { AppRuntimeContext } from "@/app/ai/types";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";
import { A011_SYSTEM_PROMPT } from "./a011";
import {
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
} from "@/app/ai/tools";

/**
 * Creates all available agents
 */
export function createAgents() {
	return [
		new Agent<LightfastUIMessage, RuntimeContext<AppRuntimeContext>, typeof a011Tools>({
			name: "a011",
			system: A011_SYSTEM_PROMPT,
			tools: a011Tools,
			model: gateway("anthropic/claude-4-sonnet"),
			experimental_transform: smoothStream({
				delayInMs: 25,
				chunking: "word",
			}),
			stopWhen: stepCountIs(30),
		}),
		// Future agents can be added here
		// new Agent({
		//   name: "vision",
		//   system: VISION_SYSTEM_PROMPT,
		//   tools: visionTools,
		//   model: gateway("anthropic/claude-4-vision"),
		//   ...
		// }),
	];
}

// Define the tool set for the a011 agent
const a011Tools = {
	// File operations
	file: fileTool,
	fileRead: fileReadTool,
	fileDelete: fileDeleteTool,
	fileStringReplace: fileStringReplaceTool,
	fileFindInContent: fileFindInContentTool,
	fileFindByName: fileFindByNameTool,

	// Web search
	webSearch: webSearchTool,

	// Sandbox operations
	createSandbox: createSandboxTool,
	executeSandboxCommand: executeSandboxCommandTool,
	createSandboxWithPorts: createSandboxWithPortsTool,
	getSandboxDomain: getSandboxDomainTool,
	listSandboxRoutes: listSandboxRoutesTool,

	// Task management
	todoWrite: todoWriteTool,
	todoRead: todoReadTool,
	todoClear: todoClearTool,
};

// Export the tool type for use in other parts of the application
export type A011Tools = typeof a011Tools;

/**
 * Get the list of available agent names
 */
export function getAvailableAgents(): string[] {
	return ["a011"]; // Add more agent names as they are created
}
