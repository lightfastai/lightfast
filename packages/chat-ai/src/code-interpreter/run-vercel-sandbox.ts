import { Sandbox } from "@vercel/sandbox";
import { generateObject } from "ai";
import { wrapTraced } from "braintrust";
import { Buffer } from "node:buffer";
import { z } from "zod";

import { createTool } from "lightfast/tool";

import type {
	CodeInterpreterToolInput,
	CodeInterpreterToolOutput,
	LightfastRuntimeContext,
} from "@repo/chat-ai-types";

const CODE_GENERATION_SCHEMA = z.object({
	language: z.literal("python"),
	code: z
		.string()
		.min(1)
		.describe("Complete Python script to execute inside the sandbox."),
});

type CodeGenerationPlan = z.infer<typeof CODE_GENERATION_SCHEMA>;

const inputSchema: z.ZodType<CodeInterpreterToolInput> = z
	.object({
		task: z.string().describe("Goal to accomplish inside the sandbox"),
		context: z
			.string()
			.optional()
			.describe("Additional details, data, or constraints for the task"),
		preferredRuntime: z
			.enum(["python3.13", "node22"] as const)
			.default("python3.13")
			.describe("Runtime image to use for the sandbox"),
	})
	.strict();

const outputSchema: z.ZodType<CodeInterpreterToolOutput> = z.object({
	code: z.string(),
	language: z.string(),
	stdout: z.string(),
	stderr: z.string(),
	exitCode: z.number(),
	sandboxId: z.string(),
	executionMs: z.number(),
});

function getRuntimeConfig(context: LightfastRuntimeContext) {
	const runtimeConfig = context.tools?.codeInterpreter;

	if (!runtimeConfig) {
		throw new Error(
			"Code interpreter tool runtime configuration is missing. Ensure codeInterpreter runtime config is provided.",
		);
	}

	if (!runtimeConfig.model) {
		throw new Error(
			"Code interpreter runtime configuration is missing the language model instance for generateObject.",
		);
	}

	return runtimeConfig;
}

export function codeInterpreterTool() {
	return createTool<
		LightfastRuntimeContext,
		typeof inputSchema,
		typeof outputSchema
	>({
	description:
		"Generate Python code with the Vercel AI SDK, execute it in a Vercel Sandbox, and return the captured output.",
		inputSchema,
		outputSchema,
		execute: wrapTraced(
			async function executeSandboxCode(
				input: CodeInterpreterToolInput,
				context: LightfastRuntimeContext,
			): Promise<CodeInterpreterToolOutput> {
				const runtimeConfig = getRuntimeConfig(context);
				const startTime = Date.now();

				const instructions = [
					`TASK:\n${input.task}`,
					input.context ? `CONTEXT:\n${input.context}` : undefined,
					`OUTPUT_REQUIREMENTS:\n- Provide clear stdout updates describing key steps.\n- Avoid long-running operations or external network calls.`,
				]
					.filter(Boolean)
					.join("\n\n");

				const systemPrompt = `You are an expert Python developer working in a fresh Vercel Sandbox environment.\n\nGuidelines:\n- Always return fully executable Python code that can run on Python 3.13 without additional dependencies unless explicitly requested.\n- The working directory is /home/vercel-sandbox. Assume the script is saved as main.py.\n- Ensure the script writes explanatory print statements to stdout describing progress and results.\n- Avoid long-running operations. Aim to finish within a couple of minutes.\n- Do not include external network calls unless explicitly authorized in the instructions.\n- Do not prompt for additional user input; the script must be self-contained.`;

				const { object: plan } = await generateObject({
					model: runtimeConfig.model,
					system: systemPrompt,
					prompt: instructions,
					schema: CODE_GENERATION_SCHEMA,
					maxOutputTokens: 1024,
				});

				const sandbox = await Sandbox.create({
					runtime:
						input.preferredRuntime ??
						runtimeConfig.defaultRuntime ??
						"python3.13",
					timeout: runtimeConfig.timeoutMs ?? 300000,
				});
				const sandboxId = sandbox.sandboxId;

				let stdout = "";
				let stderr = "";
				let exitCode = -1;
				try {
					await sandbox.writeFiles([
						{
							path: "main.py",
							content: Buffer.from(plan.code, "utf8"),
						},
					]);

					const command = await sandbox.runCommand({
						cmd: "/vercel/runtimes/python/bin/python",
						args: ["main.py"],
						cwd: "/home/vercel-sandbox",
					});

					stdout = await command.stdout();
					stderr = await command.stderr();
					exitCode = command.exitCode;
				} finally {
					await sandbox.stop().catch(() => {});
				}

				const executionMs = Date.now() - startTime;

				return {
					code: plan.code,
					language: plan.language,
					stdout,
					stderr,
					exitCode,
					sandboxId,
					executionMs,
				};
			},
			{ type: "tool", name: "codeInterpreter" },
		),
	});
}
