/**
 * Braintrust evaluation for citation format compliance across all AI models
 *
 * Tests all active models directly (no API dependency) for:
 * 1. Citation format compliance using existing citation parser
 * 2. Response quality and completeness
 * 3. Model-specific citation generation patterns
 */

import { Eval, type EvalCase, type EvalScorerArgs, initLogger } from "braintrust";
import { gateway } from "@ai-sdk/gateway";
import { generateText, wrapLanguageModel } from "ai";
import { BraintrustMiddleware } from "braintrust";
import { parseResponseMetadata, hasResponseMetadata } from "../ai/prompts/parsers/metadata-parser";
import { ACTIVE_MODELS } from "../ai/providers/models/active";
import type { ModelId } from "../ai/providers";
import { buildCitationTestPrompt, buildGeneralTestPrompt } from "../ai/prompts/builders/system-prompt-builder";
import { getBraintrustConfig } from "lightfast/v2/braintrust-env";
import { scoreAnonymousConciseness } from "../ai/prompts/scorers/concise-scorer";

// Extract model IDs from the centralized model definitions (only active models)
const ACTIVE_MODEL_IDS = Object.keys(ACTIVE_MODELS) as ModelId[];

// Citation format validator using new extensible metadata parser
function validateCitationFormat(output: string): number {
	const metadata = parseResponseMetadata(output);
	
	if (metadata.citations.length === 0) {
		return 0;
	}
	
	// Check if citations are properly structured
	const hasValidSources = metadata.citations.every(source => 
		typeof source.id === 'number' && 
		typeof source.url === 'string' && 
		source.url.startsWith('http') &&
		typeof source.title === 'string'
	);
	
	if (!hasValidSources) {
		return 0.3;
	}
	
	// Check sequential IDs starting from 1
	const ids = metadata.citations.map(s => s.id).sort((a, b) => a - b);
	const expectedIds = Array.from({ length: ids.length }, (_, i) => i + 1);
	const hasSequentialIds = JSON.stringify(ids) === JSON.stringify(expectedIds);
	
	// Check in-text citations match sources
	const inTextCitations = (output.match(/\[(\d+)\]/g) || [])
		.map(m => parseInt(m.slice(1, -1)))
		.filter(id => !isNaN(id));
		
	const allReferencedCited = inTextCitations.every(id =>
		metadata.citations.some(source => source.id === id)
	);
	
	return hasSequentialIds && allReferencedCited ? 1 : 0.7;
}

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
		return `ERROR: ${error}`;
	}
}

// Define types for our evaluation
type TestInput = { prompt: string; modelId: ModelId; expectsCitations: boolean };
type TestExpected = { expectsCitations: boolean; modelId: ModelId };
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
Eval("Citation Format Validation - All Models", {
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
		// Citation format compliance
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected, { model: string; prompt_type: string }>) => {
			const modelId = args.input.modelId;
			const expectsCitations = args.input.expectsCitations;
			
			console.log(`Scoring citation format for ${modelId}, expects: ${expectsCitations}`);

			if (expectsCitations) {
				const score = validateCitationFormat(args.output);
				console.log(`Citation validation score: ${score}`);
				return score;
			} else {
				// If no citations expected, check that none are present
				const hasMetadataInOutput = hasResponseMetadata(args.output);
				const score = hasMetadataInOutput ? 0 : 1;
				console.log(`No citations expected, found metadata: ${hasMetadataInOutput}, score: ${score}`);
				return score;
			}
		},

		// Response quality and completeness
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected, { model: string; prompt_type: string }>) => {
			const modelId = args.input.modelId;
			console.log(`Scoring response quality for ${modelId}, length: ${args.output?.length}`);
			
			if (typeof args.output !== "string") return 0;
			if (args.output.includes("ERROR:")) return 0;
			if (args.output.length < 20) return 0.2;
			if (args.output.length < 100) return 0.6;
			return 1;
		},

		// Model-specific scoring (for analytics)
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected, { model: string; prompt_type: string }>) => {
			// This creates per-model metrics in Braintrust
			const modelId = args.input.modelId;
			const expectsCitations = args.input.expectsCitations;
			
			if (args.output.includes("ERROR:")) {
				return 0; // Model failed to respond
			}
			
			// Basic functionality check per model
			const hasContent = args.output.length > 50;
			const hasValidFormat = !args.output.includes("ERROR");
			
			return hasContent && hasValidFormat ? 1 : 0;
		},

		// Anonymous user conciseness scoring
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
		}
	],
});

