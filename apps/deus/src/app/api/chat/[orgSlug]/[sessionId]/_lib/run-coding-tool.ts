import { createTool } from "lightfast/tool";
import { z } from "zod";

import type {
	RunCodingToolInput,
	RunCodingToolOutput,
	DeusLightfastRuntimeContext,
} from "@repo/deus-types";

const inputSchema: z.ZodType<RunCodingToolInput> = z.object({
	type: z
		.enum(["claude-code", "codex"])
		.describe("The agent to use for this task"),
	task: z.string().describe("The coding task to execute"),
	mcpServers: z
		.array(z.string())
		.optional()
		.describe("Optional MCP servers to enable (e.g., playwright, browserbase)"),
});

const outputSchema: z.ZodType<RunCodingToolOutput> = z.object({
	agentType: z.enum(["claude-code", "codex"]),
	status: z.enum(["completed", "error", "cancelled"]),
	message: z.string(),
	mcpServers: z.array(z.string()).optional(),
	executionTime: z.number().optional(),
	error: z.string().optional(),
});

/**
 * Run Coding Tool - Routes tasks to specialized coding agents
 *
 * This tool uses the client-side confirmation pattern.
 * When the AI calls this tool:
 * 1. Tool call is streamed to CLI with state: 'input-available'
 * 2. CLI shows confirmation prompt to user
 * 3. User confirms/denies the action
 * 4. CLI spawns the actual agent process (Claude Code or Codex)
 * 5. CLI sends the result back via addToolResult()
 * 6. Conversation continues with the agent's output
 *
 * This enables human-in-the-loop control over agent execution.
 *
 * Note: The execute function below is a placeholder for the AI SDK's agent pattern.
 * It should never actually execute because the client intercepts the tool call first.
 */
export function runCodingTool() {
	return createTool<
		DeusLightfastRuntimeContext,
		typeof inputSchema,
		typeof outputSchema
	>({
		description:
			"Execute a coding task with the specified agent (Claude Code or Codex). This requires user confirmation in the CLI before the agent starts executing.",
		inputSchema,
		outputSchema,
		execute: (
			input: RunCodingToolInput,
			_context: DeusLightfastRuntimeContext,
		): Promise<RunCodingToolOutput> => {
			// This should never execute in practice because the client handles the tool call
			// However, the AI SDK's agent pattern requires an execute function
			// If this does execute (due to client not handling it), return a pending status
			return Promise.resolve({
				agentType: input.type,
				status: "completed" as const,
				message: `Pending user confirmation for ${input.type} execution`,
				mcpServers: input.mcpServers,
			});
		},
	});
}
