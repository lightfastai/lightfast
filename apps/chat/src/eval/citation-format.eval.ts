/**
 * Braintrust evaluation for citation format compliance across all AI models
 *
 * Tests all active models directly (no API dependency) for:
 * 1. Citation format compliance using existing citation parser
 * 2. Response quality and completeness
 * 3. Model-specific citation generation patterns
 */

import { Eval, type EvalCase, type EvalScorerArgs } from "braintrust";
import { gateway } from "@ai-sdk/gateway";
import { generateText } from "ai";
import { BraintrustMiddleware } from "braintrust";
import { parseCitations, hasCitations } from "@repo/ui/lib/citation-parser";

// All active models to test
const ACTIVE_MODELS = [
	"anthropic/claude-4-sonnet",
	"openai/gpt-5-nano", 
	"openai/gpt-5-mini",
	"openai/gpt-5",
	"google/gemini-2.5-flash",
	"google/gemini-2.5-pro",
	"openai/gpt-oss-120b",
	"moonshotai/kimi-k2"
] as const;

type ModelId = typeof ACTIVE_MODELS[number];

// Citation format validator using existing citation parser
function validateCitationFormat(output: string): number {
	const citationData = parseCitations(output);
	
	if (citationData.sources.length === 0) {
		return 0;
	}
	
	// Check if citations are properly structured
	const hasValidSources = citationData.sources.every(source => 
		typeof source.id === 'number' && 
		typeof source.url === 'string' && 
		source.url.startsWith('http') &&
		typeof source.title === 'string'
	);
	
	if (!hasValidSources) {
		return 0.3;
	}
	
	// Check sequential IDs starting from 1
	const ids = citationData.sources.map(s => s.id).sort((a, b) => a - b);
	const expectedIds = Array.from({ length: ids.length }, (_, i) => i + 1);
	const hasSequentialIds = JSON.stringify(ids) === JSON.stringify(expectedIds);
	
	// Check in-text citations match sources
	const inTextCitations = (output.match(/\[(\d+)\]/g) || [])
		.map(m => parseInt(m.slice(1, -1)))
		.filter(id => !isNaN(id));
		
	const allReferencedCited = inTextCitations.every(id =>
		citationData.sources.some(source => source.id === id)
	);
	
	return hasSequentialIds && allReferencedCited ? 1 : 0.7;
}

// System prompt for citation testing (simplified from route.ts)
const CITATION_SYSTEM_PROMPT = `You are a helpful AI assistant.

When referencing external information, use numbered citations in your response and provide structured citation data.

Format: Use [1], [2], [3] etc. in your text, then end your complete response with citation data.

Example response format:
React 19 introduces server components [1] which work seamlessly with Next.js [2].

---CITATIONS---
{
  "citations": [
    {"id": 1, "url": "https://react.dev/blog/react-19", "title": "React 19 Release"},
    {"id": 2, "url": "https://nextjs.org/docs/app-router", "title": "Next.js App Router"}
  ]
}

Rules:
- Use numbered citations [1], [2], [3] in your response text
- Always end with ---CITATIONS--- followed by JSON data
- Include sequential IDs starting from 1
- Provide URLs and titles (snippets are optional)
- Only cite facts, statistics, API details, version numbers, quotes
- Don't cite common knowledge or your own analysis`;

// Test model directly using AI SDK
async function testModelDirect(
	prompt: string,
	modelId: ModelId,
	expectsCitations: boolean,
): Promise<string> {
	try {
		console.log("testModelDirect called with:", { prompt, modelId, expectsCitations });
		const result = await generateText({
			model: gateway(modelId),
			system: expectsCitations
				? CITATION_SYSTEM_PROMPT
				: "You are a helpful AI assistant.",
			prompt,
			middleware: [BraintrustMiddleware({ debug: true })]
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
const TEST_DATA: EvalCase<TestInput, TestExpected, void>[] = [];

for (const testPrompt of TEST_PROMPTS) {
	for (const modelId of ACTIVE_MODELS) {
		TEST_DATA.push({
			input: {
				prompt: testPrompt.prompt,
				modelId,
				expectsCitations: testPrompt.expectsCitations
			},
			expected: {
				expectsCitations: testPrompt.expectsCitations,
				modelId
			}
		});
	}
}

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
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected>) => {
			const modelId = args.input.modelId;
			const expectsCitations = args.input.expectsCitations;
			
			console.log(`Scoring citation format for ${modelId}, expects: ${expectsCitations}`);

			if (expectsCitations) {
				const score = validateCitationFormat(args.output);
				console.log(`Citation validation score: ${score}`);
				return score;
			} else {
				// If no citations expected, check that none are present
				const hasCitationsInOutput = hasCitations(args.output) || args.output.includes("---CITATIONS---");
				const score = hasCitationsInOutput ? 0 : 1;
				console.log(`No citations expected, found citations: ${hasCitationsInOutput}, score: ${score}`);
				return score;
			}
		},

		// Response quality and completeness
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected>) => {
			const modelId = args.input.modelId;
			console.log(`Scoring response quality for ${modelId}, length: ${args.output?.length}`);
			
			if (typeof args.output !== "string") return 0;
			if (args.output.includes("ERROR:")) return 0;
			if (args.output.length < 20) return 0.2;
			if (args.output.length < 100) return 0.6;
			return 1;
		},

		// Model-specific scoring (for analytics)
		(args: EvalScorerArgs<TestInput, TestOutput, TestExpected>) => {
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
		}
	],
});

