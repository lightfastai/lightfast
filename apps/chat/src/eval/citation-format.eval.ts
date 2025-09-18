/**
 * Braintrust evaluation for citation format compliance across all AI models
 *
 * Tests all active models directly (no API dependency) for:
 * 1. Citation format compliance using existing citation parser
 * 2. Response quality and completeness
 * 3. Model-specific citation generation patterns
 */

import { Eval, initLogger } from "braintrust";
import type { EvalCase, EvalScorerArgs } from "braintrust";
import { gateway } from "@ai-sdk/gateway";
import { generateText, wrapLanguageModel } from "ai";
import { BraintrustMiddleware } from "braintrust";
import { ACTIVE_MODELS } from "../ai/providers/models/active";
import type { ModelId } from "../ai/providers";
import { buildCitationTestPrompt, buildGeneralTestPrompt } from "../ai/prompts/builders/system-prompt-builder";
import { getBraintrustConfig } from "@repo/ai/braintrust-env";
import { scoreCitationFormat, scoreCitationCompleteness } from "../ai/prompts/scorers/citation-scorer";

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
				functionId: "citation-format-evaluation",
				metadata: {
					context: "experiment",
					experimentType: "citation-format-validation",
					modelId: modelId,
					expectsCitations: expectsCitations,
					evaluationName: "Citation Format Validation - All Models",
				},
			},
		});

		return result.text;
	} catch (error) {
		console.error("Model Error:", error);
		return `ERROR: ${String(error)}`;
	}
}

// Define types for our evaluation
interface TestInput { prompt: string; modelId: ModelId; expectsCitations: boolean }
interface TestExpected { expectsCitations: boolean; modelId: ModelId }
type TestOutput = string;

// Test prompts to evaluate with each model
const TEST_PROMPTS = [
	{
		prompt: "What are the latest features in React 19? Please provide sources.",
		expectsCitations: true,
		description: "Technical question requiring citations"
	},
	{
		prompt: "What are the performance benefits of React Server Components? Include references.", 
		expectsCitations: true,
		description: "Performance question requiring citations"
	},
	{
		prompt: "Explain how JavaScript closures work with a simple example.",
		expectsCitations: false,
		description: "General knowledge question without citations"
	},
	{
		prompt: "What is the difference between let and var in JavaScript?",
		expectsCitations: false,
		description: "Basic programming concepts without citations"
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
void Eval(braintrustConfig.projectName || "lightfast-chat-evaluation", {
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
		// Citation format compliance using dedicated scorer
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected, { model: string; prompt_type: string }>) => {
			const modelId = args.input.modelId;
			const expectsCitations = args.input.expectsCitations;
			
			console.log(`Scoring citation format for ${modelId}, expects: ${expectsCitations}`);

			if (typeof args.output !== "string") return 0;
			if (args.output.includes("ERROR:")) return 0;

			const citationResult = scoreCitationFormat(args.output, expectsCitations);
			console.log(`Citation validation result for ${modelId}:`, {
				score: citationResult.score,
				citationCount: citationResult.citationCount,
				issues: citationResult.issues
			});
			
			return citationResult.score;
		},

		// Citation completeness scoring
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected, { model: string; prompt_type: string }>) => {
			const modelId = args.input.modelId;
			const expectsCitations = args.input.expectsCitations;
			
			console.log(`Scoring citation completeness for ${modelId}`);
			
			if (typeof args.output !== "string") return 0;
			if (args.output.includes("ERROR:")) return 0;
			
			// Only score completeness for responses that should have citations
			if (!expectsCitations) return 1;
			
			const completenessScore = scoreCitationCompleteness(args.output);
			console.log(`Citation completeness score for ${modelId}: ${completenessScore}`);
			
			return completenessScore;
		},

		// Response quality and completeness
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected, { model: string; prompt_type: string }>) => {
			const modelId = args.input.modelId;
			console.log(`Scoring response quality for ${modelId}, length: ${args.output.length}`);
			
			if (typeof args.output !== "string") return 0;
			if (args.output.includes("ERROR:")) return 0;
			if (args.output.length < 20) return 0.2;
			if (args.output.length < 100) return 0.6;
			return 1;
		},

		// Model functionality check
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected, { model: string; prompt_type: string }>) => {
			const _modelId = args.input.modelId;
			
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
