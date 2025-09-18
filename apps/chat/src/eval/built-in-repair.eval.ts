/**
 * Braintrust evaluation for ACTUAL built-in repair system (experimental_repairToolCall)
 *
 * Tests the production repair system we implemented:
 * 1. Does experimental_repairToolCall actually improve success rates?
 * 2. Which models benefit most from repair?
 * 3. What types of failures can the repair system fix?
 * 4. Cost-benefit analysis of google/gemini-2.5-flash repair model
 * 5. Performance impact and latency analysis
 */

import { Eval, initLogger } from "braintrust";
import type { EvalCase, EvalScorerArgs } from "braintrust";
import { gateway } from "@ai-sdk/gateway";
import { generateText, wrapLanguageModel, tool, generateObject, NoSuchToolError } from "ai";
import { BraintrustMiddleware } from "braintrust";
import { z } from "zod";
import { ACTIVE_MODELS } from "../ai/providers/models/active";
import type { ModelId } from "../ai/providers";
import { buildAuthenticatedSystemPrompt } from "../ai/prompts/builders/system-prompt-builder";
import { getBraintrustConfig } from "@repo/ai/braintrust-env";

// Extract model IDs from the centralized model definitions (only active models)
const ACTIVE_MODEL_IDS = Object.keys(ACTIVE_MODELS) as ModelId[];

// Import the actual repair function from production (same implementation)
const productionRepairToolCall = async ({
	toolCall,
	tools,
	inputSchema,
	error,
}: {
	toolCall: any;
	tools: any;
	inputSchema: (toolCall: any) => any;
	error: Error;
}) => {
	console.log(`[Eval Repair] Attempting to repair tool call: ${toolCall.toolName}`, {
		error: error.message,
		originalInput: toolCall.input,
	});

	// Don't attempt to fix invalid tool names
	if (NoSuchToolError.isInstance(error)) {
		console.log(`[Eval Repair] Invalid tool name, cannot repair: ${toolCall.toolName}`);
		return null;
	}

	const tool = tools[toolCall.toolName as keyof typeof tools];
	if (!tool) {
		console.log(`[Eval Repair] Tool not found: ${toolCall.toolName}`);
		return null;
	}

	try {
		// Use google/gemini-2.5-flash for repair - cheap and fast
		const { object: repairedArgs } = await generateObject({
			model: gateway('google/gemini-2.5-flash'),
			schema: tool.inputSchema,
			prompt: [
				`The model tried to call the tool "${toolCall.toolName}" with the following inputs:`,
				JSON.stringify(toolCall.input),
				`The tool accepts the following schema:`,
				JSON.stringify(inputSchema(toolCall)),
				'Please fix the inputs to match the schema exactly. Preserve the original intent while ensuring all parameters are valid.',
			].join('\n'),
		});

		console.log(`[Eval Repair] Successfully repaired tool call: ${toolCall.toolName}`, {
			originalInput: toolCall.input,
			repairedArgs,
		});

		return { ...toolCall, input: JSON.stringify(repairedArgs) };
	} catch (repairError) {
		console.error(`[Eval Repair] Failed to repair tool call: ${toolCall.toolName}`, {
			repairError: repairError instanceof Error ? repairError.message : String(repairError),
			originalError: error.message,
		});
		return null;
	}
};

// Failure-prone prompts designed to trigger tool call issues
const FAILURE_SCENARIOS = [
	{
		prompt: "Create document with title '' and type 'invalid'", // Empty title, invalid type
		description: "Empty and invalid parameters",
		expectedToFail: true,
		repairShouldFix: true,
	},
	{
		prompt: "Search web for undefined query with negative results", // Malformed request
		description: "Missing and invalid parameters",
		expectedToFail: true,
		repairShouldFix: true,
	},
	{
		prompt: "Make a document called 'This is an extremely long title that exceeds normal limits' of kind 'nonexistent'",
		description: "Parameter validation failures",
		expectedToFail: true,
		repairShouldFix: true,
	},
	{
		prompt: "Use webSearch to find {query: test, results: many, format: wrong} information", // Malformed JSON-like input
		description: "JSON formatting and structure issues",
		expectedToFail: true,
		repairShouldFix: true,
	},
	{
		prompt: "Create a simple HTML document about React components", // Should work normally
		description: "Normal successful request (control)",
		expectedToFail: false,
		repairShouldFix: false, // No repair needed
	},
	{
		prompt: "Search for information about Next.js 15 features", // Should work normally
		description: "Normal search request (control)",
		expectedToFail: false,
		repairShouldFix: false, // No repair needed
	},
];

// Define tools that will intentionally fail with bad inputs
const evaluationTools = {
	createDocument: tool({
		description: "Create a document for coding, writing, or content creation activities",
		inputSchema: z.object({
			title: z.string().min(1).describe("The title of the document (2-4 words maximum)"),
			kind: z.enum(["code", "diagram", "text"]).describe("The type of document to create"),
		}),
		execute: async ({ title, kind }) => {
			// Strict validation that will cause failures
			if (!title || title.trim().length === 0) {
				throw new Error("Title cannot be empty");
			}
			if (title.split(' ').length > 6) {
				throw new Error("Title too long - should be 2-4 words maximum");
			}
			return { id: 'eval-test', title, kind, success: true };
		}
	}),
	webSearch: tool({
		description: "Advanced web search with optimized content retrieval",
		inputSchema: z.object({
			query: z.string().min(1).describe("The search query"),
			numResults: z.number().min(1).max(10).default(5).describe("Number of results to return"),
			contentType: z.enum(["highlights", "summary", "text"]).default("highlights").describe("Type of content to retrieve"),
		}),
		execute: async ({ query, numResults = 5, contentType = "highlights" }) => {
			// Strict validation that will cause failures
			if (!query || query.trim().length === 0) {
				throw new Error("Query cannot be empty");
			}
			if (numResults < 1 || numResults > 10) {
				throw new Error("Number of results must be between 1 and 10");
			}
			return { query, numResults, contentType, results: [], success: true };
		}
	})
};

// Test function that compares WITH and WITHOUT repair
async function testBuiltInRepair(
	prompt: string,
	modelId: ModelId,
	expectedToFail: boolean
): Promise<{
	withoutRepairSuccess: boolean;
	withoutRepairToolCalls: number;
	withoutRepairErrors: string[];
	withRepairSuccess: boolean;
	withRepairToolCalls: number; 
	withRepairErrors: string[];
	repairTriggered: boolean;
	repairImproved: boolean;
	latencyWithoutRepair: number;
	latencyWithRepair: number;
}> {
	const systemPrompt = buildAuthenticatedSystemPrompt(false) + "\n\nUse the available tools when appropriate to fulfill user requests.";

	try {
		// Test 1: WITHOUT repair (control group)
		const startWithout = Date.now();
		const withoutRepairResult = await generateText({
			model: wrapLanguageModel({
				model: gateway(modelId),
				middleware: BraintrustMiddleware({ debug: true }),
			}),
			system: systemPrompt,
			prompt,
			tools: evaluationTools,
			// NO experimental_repairToolCall - this is the key difference
			experimental_telemetry: {
				isEnabled: true,
				functionId: "built-in-repair-eval-without",
				metadata: {
					context: "evaluation",
					repairEnabled: false,
					modelId,
					prompt: prompt.substring(0, 50),
				},
			},
		});
		const latencyWithoutRepair = Date.now() - startWithout;

		const withoutRepairSuccess = withoutRepairResult.toolCalls && withoutRepairResult.toolCalls.length > 0 && !withoutRepairResult.text.includes("ERROR");
		const withoutRepairErrors: string[] = [];
		if (withoutRepairResult.text.includes("ERROR")) {
			withoutRepairErrors.push("Text contains ERROR");
		}

		// Test 2: WITH repair (treatment group)
		const startWith = Date.now();
		const withRepairResult = await generateText({
			model: wrapLanguageModel({
				model: gateway(modelId),
				middleware: BraintrustMiddleware({ debug: true }),
			}),
			system: systemPrompt,
			prompt,
			tools: evaluationTools,
			experimental_repairToolCall: productionRepairToolCall, // This is what we're testing!
			experimental_telemetry: {
				isEnabled: true,
				functionId: "built-in-repair-eval-with",
				metadata: {
					context: "evaluation", 
					repairEnabled: true,
					modelId,
					prompt: prompt.substring(0, 50),
				},
			},
		});
		const latencyWithRepair = Date.now() - startWith;

		const withRepairSuccess = withRepairResult.toolCalls && withRepairResult.toolCalls.length > 0 && !withRepairResult.text.includes("ERROR");
		const withRepairErrors: string[] = [];
		if (withRepairResult.text.includes("ERROR")) {
			withRepairErrors.push("Text contains ERROR");
		}

		// Determine if repair was triggered (repair success when original would have failed)
		const repairTriggered = !withoutRepairSuccess && withRepairSuccess;
		const repairImproved = repairTriggered;

		return {
			withoutRepairSuccess: !!withoutRepairSuccess,
			withoutRepairToolCalls: withoutRepairResult.toolCalls?.length || 0,
			withoutRepairErrors,
			withRepairSuccess: !!withRepairSuccess,
			withRepairToolCalls: withRepairResult.toolCalls?.length || 0,
			withRepairErrors,
			repairTriggered,
			repairImproved,
			latencyWithoutRepair,
			latencyWithRepair,
		};

	} catch (error) {
		console.error("Built-in repair test error:", error);
		return {
			withoutRepairSuccess: false,
			withoutRepairToolCalls: 0,
			withoutRepairErrors: [String(error)],
			withRepairSuccess: false,
			withRepairToolCalls: 0,
			withRepairErrors: [String(error)],
			repairTriggered: false,
			repairImproved: false,
			latencyWithoutRepair: 0,
			latencyWithRepair: 0,
		};
	}
}

// Define evaluation types
interface TestInput {
	prompt: string;
	modelId: ModelId;
	expectedToFail: boolean;
	repairShouldFix: boolean;
	scenario: string;
}

interface TestExpected {
	expectedToFail: boolean;
	repairShouldFix: boolean;
}

type TestOutput = {
	withoutRepairSuccess: boolean;
	withoutRepairToolCalls: number;
	withoutRepairErrors: string[];
	withRepairSuccess: boolean;
	withRepairToolCalls: number;
	withRepairErrors: string[];
	repairTriggered: boolean;
	repairImproved: boolean;
	latencyWithoutRepair: number;
	latencyWithRepair: number;
};

// Generate test data: Each scenario × each model
const TEST_DATA: EvalCase<TestInput, TestExpected, {
	model: string;
	scenario: string;
	expectedToFail: boolean;
}>[] = [];

for (const scenario of FAILURE_SCENARIOS) {
	for (const modelId of ACTIVE_MODEL_IDS) {
		TEST_DATA.push({
			input: {
				prompt: scenario.prompt,
				modelId,
				expectedToFail: scenario.expectedToFail,
				repairShouldFix: scenario.repairShouldFix,
				scenario: scenario.description,
			},
			expected: {
				expectedToFail: scenario.expectedToFail,
				repairShouldFix: scenario.repairShouldFix,
			},
			metadata: {
				model: modelId,
				scenario: scenario.description,
				expectedToFail: scenario.expectedToFail,
			}
		});
	}
}

// Initialize Braintrust logging
const braintrustConfig = getBraintrustConfig();
initLogger({
	apiKey: braintrustConfig.apiKey,
	projectName: braintrustConfig.projectName || "lightfast-chat-evaluation",
});

// Main evaluation
void Eval(braintrustConfig.projectName || "lightfast-chat-evaluation", {
	data: TEST_DATA,

	task: async (input: TestInput): Promise<TestOutput> => {
		console.log(`Testing built-in repair: ${input.modelId} with "${input.scenario}"`);
		
		const result = await testBuiltInRepair(
			input.prompt,
			input.modelId,
			input.expectedToFail
		);
		
		return result;
	},

	scores: [
		// Repair Effectiveness: Does repair actually improve success rates?
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected, any>) => {
			const modelId = args.input.modelId;
			const expectedToFail = args.input.expectedToFail;
			const withoutRepairSuccess = args.output.withoutRepairSuccess;
			const withRepairSuccess = args.output.withRepairSuccess;
			
			console.log(`Scoring repair effectiveness for ${modelId}: without=${withoutRepairSuccess}, with=${withRepairSuccess}, expected_to_fail=${expectedToFail}`);
			
			// If the original was expected to fail but repair fixed it = excellent
			if (expectedToFail && !withoutRepairSuccess && withRepairSuccess) return 1;
			
			// If both succeeded (good, no regression) = good
			if (withoutRepairSuccess && withRepairSuccess) return 0.8;
			
			// If repair didn't help when it should have = poor
			if (expectedToFail && !withoutRepairSuccess && !withRepairSuccess) return 0;
			
			// If repair broke something that worked = very bad
			if (!expectedToFail && withoutRepairSuccess && !withRepairSuccess) return 0;
			
			return 0.5;
		},

		// Repair Trigger Accuracy: Does repair activate only when needed?
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected, any>) => {
			const modelId = args.input.modelId;
			const repairTriggered = args.output.repairTriggered;
			const expectedToFail = args.input.expectedToFail;
			const repairShouldFix = args.input.repairShouldFix;
			
			console.log(`Scoring repair trigger accuracy for ${modelId}: triggered=${repairTriggered}, should_fix=${repairShouldFix}`);
			
			// Repair triggered when it should = good
			if (expectedToFail && repairShouldFix && repairTriggered) return 1;
			
			// Repair didn't trigger when not needed = good
			if (!expectedToFail && !repairTriggered) return 1;
			
			// Repair didn't trigger when it should have = poor
			if (expectedToFail && repairShouldFix && !repairTriggered) return 0;
			
			return 0.5;
		},

		// Latency Impact: How much does repair add to response time?
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected, any>) => {
			const latencyWithout = args.output.latencyWithoutRepair;
			const latencyWith = args.output.latencyWithRepair;
			
			if (latencyWithout === 0) return 1; // No measurement
			
			const latencyIncrease = (latencyWith - latencyWithout) / latencyWithout;
			
			console.log(`Scoring latency impact: without=${latencyWithout}ms, with=${latencyWith}ms, increase=${(latencyIncrease * 100).toFixed(1)}%`);
			
			// Less than 20% increase = excellent
			if (latencyIncrease < 0.2) return 1;
			// Less than 50% increase = good  
			if (latencyIncrease < 0.5) return 0.8;
			// Less than 100% increase = acceptable
			if (latencyIncrease < 1.0) return 0.6;
			// More than 100% increase = poor
			return 0.3;
		},

		// Overall Built-in Repair Score
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected, any>) => {
			const modelId = args.input.modelId;
			const repairImproved = args.output.repairImproved;
			const withoutRepairSuccess = args.output.withoutRepairSuccess;
			const withRepairSuccess = args.output.withRepairSuccess;
			const repairTriggered = args.output.repairTriggered;
			
			console.log(`Scoring overall built-in repair for ${modelId}`);
			
			let score = 0.5; // Base score
			
			// Bonus for successful repairs
			if (repairImproved) score += 0.4;
			
			// Bonus for no regressions
			if (withoutRepairSuccess === withRepairSuccess && withRepairSuccess) score += 0.2;
			
			// Bonus for appropriate repair triggering
			if (repairTriggered && !withoutRepairSuccess) score += 0.2;
			
			// Penalty for breaking working cases
			if (withoutRepairSuccess && !withRepairSuccess) score -= 0.5;
			
			return Math.max(0, Math.min(1, score));
		}
	],
});
