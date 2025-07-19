import { anthropic } from "@ai-sdk/anthropic";
import { Agent } from "@mastra/core/agent";
import {
	AnswerRelevancyMetric,
	FaithfulnessMetric,
	HallucinationMetric,
	PromptAlignmentMetric,
	ToxicityMetric,
} from "@mastra/evals/llm";
import { v1Agent } from "./v1-agent";

// Model for eval judgments - using a cheaper model for evals
const evalModel = anthropic("claude-3-5-haiku-20241022");

/**
 * V1 Agent with basic evaluation metrics attached
 *
 * This version of the V1 agent includes core evaluation metrics
 * for testing and quality assurance.
 */
export const v1AgentWithEvals = new Agent({
	name: "V1AgentWithEvals",
	description: v1Agent.description,
	instructions: v1Agent.instructions,
	model: v1Agent.model,
	tools: v1Agent.tools,
	memory: v1Agent.memory,
	evals: {
		// Core accuracy metrics
		hallucination: new HallucinationMetric(evalModel, { scale: 10 }),
		faithfulness: new FaithfulnessMetric(evalModel, { scale: 10 }),
		answerRelevancy: new AnswerRelevancyMetric(evalModel, { scale: 10 }),

		// Instruction following
		promptAlignment: new PromptAlignmentMetric(evalModel, { scale: 10 }),

		// Safety
		toxicity: new ToxicityMetric(evalModel, { scale: 10 }),
	},
});

/**
 * Simple test function to demonstrate eval usage
 */
export async function testWithEvals(prompt: string = "Create a hello world Python script") {
	console.log("🧪 Testing V1 Agent with Evals\n");
	console.log(`Prompt: "${prompt}"\n`);

	try {
		const response = await v1AgentWithEvals.generate(prompt, {
			threadId: `test-${Date.now()}`,
			resourceId: "eval-test",
		});

		console.log("📝 Response:");
		console.log(response.text);

		// Debug: log entire response structure
		console.log("\n🔍 Response structure:", Object.keys(response));
		console.log("🔍 Response object:", JSON.stringify(response, null, 2));
		
		// Check for eval results in different locations
		const evalResults = response.evalResults || response.evals || response.metrics;
		
		if (evalResults) {
			console.log("\n📊 Evaluation Results:");

			for (const [metric, result] of Object.entries(evalResults)) {
				const score = (result.score * 100).toFixed(0);
				const emoji = result.score > 0.8 ? "✅" : result.score > 0.6 ? "⚠️" : "❌";
				console.log(`  ${emoji} ${metric}: ${score}%`);

				if (result.info?.reason) {
					console.log(`     → ${result.info.reason}`);
				}
			}

			// Calculate average score
			const scores = Object.values(evalResults).map((r: any) => r.score);
			const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
			console.log(`\n📈 Average Score: ${(avgScore * 100).toFixed(0)}%`);
		} else {
			console.log("\n⚠️  No eval results found in response");
		}

		return response;
	} catch (error) {
		console.error("❌ Error:", error);
		throw error;
	}
}

// If running directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const testPrompt = process.argv[2] || "Create a simple calculator function in Python";
	testWithEvals(testPrompt).catch(console.error);
}
