/**
 * Braintrust evaluation for response conciseness compliance across all AI models
 *
 * Tests all active models for anonymous user length constraints:
 * 1. Response length compliance (200-800 chars ideal)
 * 2. Information density scoring
 * 3. Progressive penalty system for verbose responses
 */

import { Eval, type EvalCase, type EvalScorerArgs, initLogger } from "braintrust";
import { gateway } from "@ai-sdk/gateway";
import { generateText, wrapLanguageModel } from "ai";
import { BraintrustMiddleware } from "braintrust";
import { ACTIVE_MODELS } from "../ai/providers/models/active";
import type { ModelId } from "../ai/providers";
import { buildCitationTestPrompt, buildGeneralTestPrompt } from "../ai/prompts/builders/system-prompt-builder";
import { getBraintrustConfig } from "lightfast/v2/braintrust-env";
import { scoreAnonymousConciseness } from "../ai/prompts/scorers/concise-scorer";

// Extract model IDs from the centralized model definitions (only active models)
const ACTIVE_MODEL_IDS = Object.keys(ACTIVE_MODELS) as ModelId[];

// Test model directly using AI SDK with production-identical prompts
async function testModelDirect(
	prompt: string,
	modelId: ModelId,
	expectsCitations: boolean,
): Promise<string> {
	try {
		console.log("testModelDirect called with:", { prompt, modelId, expectsCitations });
		
		// Use production-identical system prompts via prompt builder
		const systemPrompt = expectsCitations 
			? buildCitationTestPrompt()
			: buildGeneralTestPrompt();
			
		const result = await generateText({
			model: wrapLanguageModel({
				model: gateway(modelId),
				middleware: BraintrustMiddleware({ debug: true }),
			}),
			system: systemPrompt,
			prompt,
			experimental_telemetry: {
				isEnabled: true,
				functionId: "concise-format-evaluation",
				metadata: {
					context: "experiment",
					experimentType: "concise-format-validation",
					modelId: modelId,
					expectsCitations: expectsCitations,
					evaluationName: "Concise Format Validation - All Models",
				},
			},
		});

		return result.text;
	} catch (error) {
		console.error("Model Error:", error);
		return `ERROR: ${error}`;
	}
}

// Define types for our evaluation
type TestInput = { prompt: string; modelId: ModelId; expectsCitations: boolean };
type TestExpected = { expectsCitations: boolean; modelId: ModelId };
type TestOutput = string;

// Test prompts focusing on different response lengths
const TEST_PROMPTS = [
	{
		prompt: "What are closures in JavaScript?",
		expectsCitations: false,
		description: "Basic concept explanation - should be concise"
	},
	{
		prompt: "Explain the differences between let, var, and const in JavaScript with examples.",
		expectsCitations: false,
		description: "Detailed comparison - test length management"
	},
	{
		prompt: "What are the latest React 19 features? Please provide sources.",
		expectsCitations: true,
		description: "Technical question with citations - length + metadata"
	},
	{
		prompt: "How does React Server Components improve performance? Include references and detailed explanations.",
		expectsCitations: true,
		description: "Complex technical topic - test verbose response handling"
	}
];

// Generate test data: each prompt × each model = comprehensive evaluation
const TEST_DATA: EvalCase<TestInput, TestExpected, { model: string; prompt_type: string }>[] = [];

for (const testPrompt of TEST_PROMPTS) {
	for (const modelId of ACTIVE_MODEL_IDS) {
		TEST_DATA.push({
			input: {
				prompt: testPrompt.prompt,
				modelId,
				expectsCitations: testPrompt.expectsCitations
			},
			expected: {
				expectsCitations: testPrompt.expectsCitations,
				modelId
			},
			metadata: {
				model: modelId,
				prompt_type: testPrompt.description
			}
		});
	}
}

// Initialize Braintrust logging with configured project name
const braintrustConfig = getBraintrustConfig();
initLogger({
	apiKey: braintrustConfig.apiKey,
	projectName: braintrustConfig.projectName || "lightfast-chat-evaluation",
});

// Main evaluation
Eval("Concise Format Validation - All Models", {
	data: TEST_DATA,

	task: async (input: TestInput): Promise<TestOutput> => {
		console.log(`Testing ${input.modelId} with prompt: "${input.prompt.substring(0, 50)}..."`);
		
		const result = await testModelDirect(
			input.prompt,
			input.modelId,
			input.expectsCitations
		);
		
		return result;
	},

	scores: [
		// Primary conciseness scoring for anonymous users
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected, { model: string; prompt_type: string }>) => {
			const modelId = args.input.modelId;
			console.log(`Scoring conciseness for ${modelId}, length: ${args.output?.length}`);
			
			if (typeof args.output !== "string") return 0;
			if (args.output.includes("ERROR:")) return 0;
			
			const conciseResult = scoreAnonymousConciseness(args.output);
			console.log(`Conciseness result for ${modelId}:`, {
				combinedScore: conciseResult.combinedScore,
				lengthPenalty: conciseResult.conciseScore.lengthPenalty,
				reasonCode: conciseResult.conciseScore.reasonCode,
				actualLength: conciseResult.conciseScore.actualLength,
				recommendedAction: conciseResult.recommendedAction
			});
			
			return conciseResult.combinedScore;
		},

		// Information density scoring
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected, { model: string; prompt_type: string }>) => {
			const modelId = args.input.modelId;
			console.log(`Scoring information density for ${modelId}`);
			
			if (typeof args.output !== "string") return 0;
			if (args.output.includes("ERROR:")) return 0;
			
			const conciseResult = scoreAnonymousConciseness(args.output);
			return conciseResult.densityScore;
		},

		// Response quality check
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected, { model: string; prompt_type: string }>) => {
			const modelId = args.input.modelId;
			console.log(`Scoring response quality for ${modelId}, length: ${args.output?.length}`);
			
			if (typeof args.output !== "string") return 0;
			if (args.output.includes("ERROR:")) return 0;
			if (args.output.length < 20) return 0.2;
			if (args.output.length < 100) return 0.6;
			return 1;
		},

		// Model functionality check
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected, { model: string; prompt_type: string }>) => {
			const modelId = args.input.modelId;
			
			if (args.output.includes("ERROR:")) {
				return 0; // Model failed to respond
			}
			
			// Basic functionality check per model
			const hasContent = args.output.length > 50;
			const hasValidFormat = !args.output.includes("ERROR");
			
			return hasContent && hasValidFormat ? 1 : 0;
		}
	],
});