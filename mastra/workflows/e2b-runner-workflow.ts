import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { commandPlanner } from "../agents/command-planner";
import { sandboxExecutor } from "../agents/sandbox-executor";

// Define schemas
const commandSchema = z.object({
	command: z.string(),
	args: z.array(z.string()),
	description: z.string(),
	expectedOutput: z.string(),
});

const commandPlanSchema = z.object({
	commands: z.array(commandSchema),
	explanation: z.string(),
});

// Step 1: Plan the commands
const planCommandsStep = createStep({
	id: "plan-commands",
	description: "Analyze the task and plan Linux commands",
	inputSchema: z.object({
		prompt: z.string(),
	}),
	outputSchema: z.object({
		plan: commandPlanSchema,
	}),
	execute: async ({ inputData }) => {
		const { prompt } = inputData;

		const planPrompt = `Task: ${prompt}

Please analyze this task and provide the Linux commands needed to accomplish it.`;

		const response = await commandPlanner.generate(planPrompt, {
			output: z.object({
				plan: commandPlanSchema,
			}),
		});

		return { plan: response.object.plan };
	},
});

// Step 2: Execute commands in sandbox
const executeCommandsStep = createStep({
	id: "execute-commands",
	description: "Execute the planned commands in Vercel sandbox",
	inputSchema: z.object({
		commands: z.array(commandSchema),
		explanation: z.string(),
	}),
	outputSchema: z.object({
		results: z.array(
			z.object({
				command: z.string(),
				args: z.array(z.string()),
				description: z.string(),
				output: z.object({
					success: z.boolean(),
					stdout: z.string(),
					stderr: z.string(),
					exitCode: z.number(),
				}),
			}),
		),
		summary: z.string(),
	}),
	execute: async ({ inputData }) => {
		const { commands } = inputData;
		const results = [];

		// Execute each command sequentially
		for (const cmd of commands) {
			const executionPrompt = `Execute this command in the sandbox:
Command: ${cmd.command}
Arguments: ${JSON.stringify(cmd.args)}
Description: ${cmd.description}

Use the execute_command tool to run this command and return the results.`;

			const response = await sandboxExecutor.generate(executionPrompt);

			// Parse the execution result from the agent's response
			// The agent should have used the tool and reported the results
			const output = {
				success: response.text.includes("successfully") || response.text.includes("Success"),
				stdout: extractOutput(response.text, "stdout") || extractOutput(response.text, "output") || "",
				stderr: extractOutput(response.text, "stderr") || extractOutput(response.text, "error") || "",
				exitCode: extractExitCode(response.text),
			};

			results.push({
				command: cmd.command,
				args: cmd.args,
				description: cmd.description,
				output,
			});

			// Stop execution if a command fails (unless it's expected)
			if (!output.success && !cmd.expectedOutput.includes("may fail")) {
				break;
			}
		}

		// Generate summary
		const successfulCommands = results.filter((r) => r.output.success).length;
		const summary = `Executed ${results.length} commands. ${successfulCommands} succeeded, ${
			results.length - successfulCommands
		} failed.`;

		return { results, summary };
	},
});

// Helper functions to parse agent responses
function extractOutput(text: string, type: string): string {
	const patterns = [
		new RegExp(`${type}:\\s*(.*)`, "i"),
		new RegExp(`${type}.*?:\\s*\`([^\`]+)\``, "i"),
		new RegExp(`${type}.*?"([^"]+)"`, "i"),
	];

	for (const pattern of patterns) {
		const match = text.match(pattern);
		if (match) {
			return match[1].trim();
		}
	}
	return "";
}

function extractExitCode(text: string): number {
	const patterns = [/exit\s*code:\s*(\d+)/i, /exitCode:\s*(\d+)/i, /returned\s*(\d+)/i, /code\s*(\d+)/i];

	for (const pattern of patterns) {
		const match = text.match(pattern);
		if (match) {
			return parseInt(match[1], 10);
		}
	}
	return text.includes("success") || text.includes("Success") ? 0 : 1;
}

// Step 3: Format the final output
const formatOutputStep = createStep({
	id: "format-output",
	description: "Format the execution results",
	inputSchema: z.object({
		prompt: z.string(),
		results: z.array(
			z.object({
				command: z.string(),
				args: z.array(z.string()),
				description: z.string(),
				output: z.object({
					success: z.boolean(),
					stdout: z.string(),
					stderr: z.string(),
					exitCode: z.number(),
				}),
			}),
		),
		summary: z.string(),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		output: z.string(),
		details: z.object({
			commands: z.array(z.string()),
			results: z.array(z.string()),
		}),
	}),
	execute: async ({ inputData }) => {
		const { prompt, results, summary } = inputData;

		// Check if all commands succeeded
		const allSuccess = results.every((r) => r.output.success);

		// Extract the main output (usually from the last successful command)
		let mainOutput = "";
		for (let i = results.length - 1; i >= 0; i--) {
			if (results[i].output.success && results[i].output.stdout) {
				mainOutput = results[i].output.stdout;
				break;
			}
		}

		// Format command list and results
		const commands = results.map((r) => `${r.command} ${r.args.join(" ")}`);
		const formattedResults = results.map((r) => {
			if (r.output.success) {
				return `✓ ${r.description}: ${r.output.stdout || "Completed successfully"}`;
			} else {
				return `✗ ${r.description}: ${r.output.stderr || "Failed"}`;
			}
		});

		// Create final output message
		const output = allSuccess
			? `Task completed successfully.\n\nResult: ${mainOutput}\n\n${summary}`
			: `Task partially completed with errors.\n\n${
					mainOutput ? `Result: ${mainOutput}\n\n` : ""
				}${summary}\n\nErrors encountered:\n${results
					.filter((r) => !r.output.success)
					.map((r) => `- ${r.description}: ${r.output.stderr}`)
					.join("\n")}`;

		return {
			success: allSuccess,
			output,
			details: {
				commands,
				results: formattedResults,
			},
		};
	},
});

// Main workflow
export const e2bRunnerWorkflow = createWorkflow({
	id: "e2b-runner-workflow",
	description: "Execute Linux commands in Vercel sandbox based on natural language prompts",
	inputSchema: z.object({
		prompt: z.string().describe("Natural language description of what to do"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		output: z.string(),
		details: z.object({
			commands: z.array(z.string()),
			results: z.array(z.string()),
		}),
	}),
})
	.then(planCommandsStep)
	.then(
		createStep({
			id: "prepare-execution",
			description: "Prepare commands for execution",
			inputSchema: z.object({
				plan: commandPlanSchema,
			}),
			outputSchema: z.object({
				commands: z.array(commandSchema),
				explanation: z.string(),
			}),
			execute: async ({ inputData }) => {
				return {
					commands: inputData.plan.commands,
					explanation: inputData.plan.explanation,
				};
			},
		}),
	)
	.then(executeCommandsStep)
	.then(
		createStep({
			id: "prepare-formatting",
			description: "Prepare data for final formatting",
			inputSchema: z.object({
				results: z.array(
					z.object({
						command: z.string(),
						args: z.array(z.string()),
						description: z.string(),
						output: z.object({
							success: z.boolean(),
							stdout: z.string(),
							stderr: z.string(),
							exitCode: z.number(),
						}),
					}),
				),
				summary: z.string(),
			}),
			outputSchema: z.object({
				prompt: z.string(),
				results: z.array(
					z.object({
						command: z.string(),
						args: z.array(z.string()),
						description: z.string(),
						output: z.object({
							success: z.boolean(),
							stdout: z.string(),
							stderr: z.string(),
							exitCode: z.number(),
						}),
					}),
				),
				summary: z.string(),
			}),
			execute: async ({ inputData, getInitData }) => {
				const initData = getInitData();
				return {
					prompt: initData.prompt,
					results: inputData.results,
					summary: inputData.summary,
				};
			},
		}),
	)
	.then(formatOutputStep)
	.commit();
