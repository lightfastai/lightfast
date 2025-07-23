import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { z } from "zod";
import { gatewayModels } from "@/lib/ai/provider";
import { createSandboxTool, executeSandboxCommandTool } from "../../tools/sandbox-tools";

// Schema for working memory
const sandboxMemorySchema = z.object({
	sandboxId: z.string().nullable().default(null),
	currentDirectory: z.string().default("/home/vercel-sandbox"),
	commandHistory: z
		.array(
			z.object({
				command: z.string(),
				timestamp: z.string(),
				success: z.boolean(),
			}),
		)
		.default([]),
	createdFiles: z.array(z.string()).default([]),
	installedPackages: z.array(z.string()).default([]),
});

export const sandboxAgent = new Agent({
	name: "Sandbox",
	description: "Creates a sandbox once and reuses it for all commands",
	instructions: `You are a sandbox executor that maintains a persistent sandbox session.

## How to Work

1. **First Time Only - Create Sandbox**:
   - Create a new Vercel sandbox using the Sandbox API
   - Store the sandbox ID in your working memory
   - This sandbox will be reused for all subsequent commands

2. **Execute Commands**:
   - Use execute_sandbox_command with the sandboxId from memory
   - Track the current directory in memory
   - Update working directory when using cd commands
   - Show the full command output to the user

3. **Memory Management**:
   - sandboxId: Set once when creating sandbox
   - currentDirectory: Update when using cd
   - commandHistory: Track all executed commands
   - createdFiles: Track files you create
   - installedPackages: Track installed packages

## First Step - ALWAYS
If sandboxId is not in your memory:
1. Use create_sandbox tool to create a new sandbox
2. Store the returned sandboxId in your working memory
3. Use this ID for all subsequent execute_sandbox_command calls

## Task: Repository Investigation
1. Create sandbox and store ID
2. Clone repository
3. Navigate to directory (update currentDirectory)
4. Examine package.json
5. Check for lock files
6. Provide detailed analysis with actual file contents`,
	model: gatewayModels.claude4Sonnet,
	memory: new Memory({
		options: {
			workingMemory: {
				enabled: true,
				scope: "thread",
				schema: sandboxMemorySchema,
			},
			lastMessages: 20,
		},
	}),
	tools: {
		create_sandbox: createSandboxTool,
		execute_sandbox_command: executeSandboxCommandTool,
	},
	defaultGenerateOptions: {
		maxSteps: 20,
		maxRetries: 3,
	},
	defaultStreamOptions: {
		maxSteps: 40,
		maxRetries: 3,
		onChunk: ({ chunk }) => {
			console.log(chunk);
		},
		onFinish: (res) => {
			console.log(res);
		},
	},
});
