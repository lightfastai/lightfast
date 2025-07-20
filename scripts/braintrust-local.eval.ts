/**
 * Braintrust Local Evaluation Script
 *
 * This script demonstrates how to run Braintrust evaluations locally
 * without sending data to remote servers.
 *
 * Usage:
 * 1. Local mode with console logging:
 *    BRAINTRUST_LOCAL_MODE=true npx tsx scripts/braintrust-local-eval.ts
 *
 * 2. Local evaluation without remote logging:
 *    npx braintrust eval --no-send-logs scripts/braintrust-local-eval.ts
 *
 * 3. Local dev server with playground:
 *    npx braintrust eval --dev --dev-port 8300 scripts/braintrust-local-eval.ts
 */

import { Eval } from "braintrust";

// Sample evaluation data for HAL9000 agents
const evaluationData = [
	{
		input: { query: "What is 2 + 2?", agent: "Math" },
		expected: "4",
		metadata: { category: "basic_math", difficulty: "easy" },
	},
	{
		input: { query: "Search for latest AI news", agent: "Searcher" },
		expected: "Recent AI developments",
		metadata: { category: "web_search", difficulty: "medium" },
	},
	{
		input: { query: "Create a todo list app", agent: "V010" },
		expected: "Complete application with functionality",
		metadata: { category: "development", difficulty: "hard" },
	},
];

// Evaluation function that simulates agent responses
async function simulateAgentResponse(input: any): Promise<string> {
	const { query, agent } = input;

	// Simulate different response times and outcomes
	const delay = Math.random() * 1000 + 500;
	await new Promise((resolve) => setTimeout(resolve, delay));

	switch (agent) {
		case "Math":
			return query.includes("2 + 2") ? "4" : "I can calculate that for you";
		case "Searcher":
			return "Here are the latest AI developments: [search results]";
		case "V010":
			return "I'll create a todo list app with the following components...";
		default:
			return "I can help you with that request";
	}
}

// Scoring function to evaluate response quality
function scoreResponse(input: any, output: string, expected: string): Record<string, number> {
	const scores: Record<string, number> = {};

	// Handle undefined values
	const outputStr = output || "";
	const expectedStr = expected || "";

	// Basic relevancy score
	scores.relevancy = outputStr.toLowerCase().includes(expectedStr.toLowerCase()) ? 1 : 0.5;

	// Response length score (not too short, not too verbose)
	const wordCount = outputStr.split(/\s+/).length;
	scores.completeness = wordCount >= 5 && wordCount <= 100 ? 1 : 0.7;

	// Agent-specific scoring
	switch (input.agent) {
		case "Math":
			scores.accuracy = outputStr.includes("4") ? 1 : 0;
			break;
		case "Searcher":
			scores.informativeness = outputStr.includes("developments") ? 1 : 0.5;
			break;
		case "V010":
			scores.actionability = outputStr.includes("create") || outputStr.includes("app") ? 1 : 0.5;
			break;
	}

	return scores;
}

// Main evaluation function
Eval("hal9000-local-evaluation", {
	data: () => evaluationData,
	task: async (input) => {
		console.log(`[EVAL] Testing ${input.agent} agent with query: "${input.query}"`);

		const startTime = Date.now();
		const output = await simulateAgentResponse(input);
		const duration = Date.now() - startTime;

		console.log(`[EVAL] Response in ${duration}ms: "${output.substring(0, 50)}..."`);

		return output;
	},
	scores: [
		(input, output, expected) => {
			const scores = scoreResponse(input, output, expected);
			console.log(`[EVAL] Scores for ${input.agent}:`, scores);
			return scores;
		},
	],
	metadata: {
		description: "Local evaluation of HAL9000 agents",
		version: "1.0.0",
		environment: "local",
		timestamp: new Date().toISOString(),
	},
});

console.log(`
🧪 HAL9000 Local Evaluation Started

This script demonstrates local Braintrust evaluation capabilities:

📊 Test Data: ${evaluationData.length} evaluation cases
🤖 Agents: Math, Searcher, V010
⚡ Mode: ${process.env.BRAINTRUST_LOCAL_MODE === "true" ? "Local Console Logging" : "Braintrust Evaluation"}

To run in different modes:
1. Local console logging: BRAINTRUST_LOCAL_MODE=true npx tsx scripts/braintrust-local-eval.ts
2. No remote logging: npx braintrust eval --no-send-logs scripts/braintrust-local-eval.ts  
3. Dev server: npx braintrust eval --dev --dev-port 8300 scripts/braintrust-local-eval.ts

Visit http://localhost:8300 for the Braintrust playground when using --dev mode.
`);
