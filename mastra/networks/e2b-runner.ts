import { anthropic } from "@ai-sdk/anthropic";
import { NewAgentNetwork } from "@mastra/core/network/vNext";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { commandPlanner } from "../agents/command-planner";
import { sandboxExecutor } from "../agents/sandbox-executor";
import { e2bRunnerWorkflow } from "../workflows/e2b-runner-workflow";

// Quick command execution workflow for simple, single commands
const quickCommandWorkflow = createWorkflow({
	id: "quick-command",
	description: "Execute a single simple command quickly",
	inputSchema: z.object({
		command: z.string().describe("Direct command to execute"),
	}),
	outputSchema: z.object({
		output: z.string(),
		success: z.boolean(),
	}),
})
	.then(
		createStep({
			id: "quick-execute",
			description: "Execute a single command directly",
			inputSchema: z.object({
				command: z.string(),
			}),
			outputSchema: z.object({
				output: z.string(),
				success: z.boolean(),
			}),
			execute: async ({ inputData }) => {
				// Use the sandbox executor agent to run the command
				const executionPrompt = `Execute this command in the sandbox:
${inputData.command}

Use the execute_command tool and return the output.`;

				const response = await sandboxExecutor.generate(executionPrompt);

				// Extract result from response
				const success = response.text.includes("successfully") || response.text.includes("Success");
				const output = extractOutput(response.text) || "Command executed";

				return {
					output,
					success,
				};
			},
		}),
	)
	.commit();

// Helper function to extract output from agent response
function extractOutput(text: string): string {
	// Try to find output in various formats
	const patterns = [
		/output:\s*"([^"]+)"/i,
		/stdout:\s*"([^"]+)"/i,
		/result:\s*"([^"]+)"/i,
		/output:\s*`([^`]+)`/i,
		/stdout:\s*`([^`]+)`/i,
		/result:\s*`([^`]+)`/i,
		/output:\s*(.+?)(?:\n|$)/i,
	];

	for (const pattern of patterns) {
		const match = text.match(pattern);
		if (match) {
			return match[1].trim();
		}
	}

	// If no specific output pattern found, try to extract any quoted or code-blocked content
	const quotedMatch = text.match(/"([^"]+)"/);
	if (quotedMatch) {
		return quotedMatch[1];
	}

	const codeBlockMatch = text.match(/`([^`]+)`/);
	if (codeBlockMatch) {
		return codeBlockMatch[1];
	}

	return "";
}

// Export the e2b-runner network
export const e2bRunnerNetwork = new NewAgentNetwork({
	id: "e2b-runner",
	name: "E2B Runner Network",
	instructions: `You are an intelligent command execution network that can understand natural language requests and execute the appropriate Linux commands in a secure Vercel sandbox environment.

You have two main workflows:

1. **Full Execution Workflow**: For complex tasks requiring multiple commands
   - Analyzes the request and plans the necessary commands
   - Executes commands sequentially in the sandbox
   - Provides detailed output and error handling

2. **Quick Command Workflow**: For simple, direct command execution
   - Executes a single command immediately
   - Returns the output quickly

Examples of tasks you can handle:
- "Generate a 16 character password" → Uses openssl or similar tools
- "Create a directory structure for a web project" → Uses mkdir commands
- "Show system information" → Uses uname, df, ps commands
- "Download and extract a file" → Uses curl/wget and tar commands
- "List all Python files in the current directory" → Uses find or ls commands

IMPORTANT:
- Always prioritize security and use safe commands
- Provide clear feedback about what was executed
- Handle errors gracefully and explain failures
- For password generation, use cryptographically secure methods`,
	model: anthropic("claude-4-sonnet-20250514"),
	agents: {
		commandPlanner,
		sandboxExecutor,
	},
	workflows: {
		e2bRunnerWorkflow,
		quickCommandWorkflow,
	},
});