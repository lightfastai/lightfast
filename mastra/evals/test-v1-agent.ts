#!/usr/bin/env tsx

import { v1AgentWithEvals } from "./v1-agent-evals";

/**
 * Quick test script for V1 agent with evals
 *
 * Usage: pnpm tsx mastra/evals/test-v1-agent.ts "your test prompt"
 */

async function testAgent() {
	const testPrompt = process.argv[2] || "Create a simple hello world file and read it back";

	console.log("🤖 Testing V1 Agent with Evals\n");
	console.log(`Prompt: "${testPrompt}"\n`);
	console.log("Generating response...\n");

	try {
		const response = await v1AgentWithEvals.generate(testPrompt, {
			// Enable eval results in response
			includeEvalResults: true,
		} as any);

		console.log("📝 Response:");
		console.log(response.text);

		if (response.evalResults) {
			console.log("\n📊 Evaluation Scores:");
			Object.entries(response.evalResults).forEach(([metric, result]: [string, any]) => {
				const score = (result.score * 100).toFixed(0);
				const emoji = result.score > 0.8 ? "✅" : result.score > 0.6 ? "⚠️" : "❌";
				console.log(`  ${emoji} ${metric}: ${score}%`);
				if (result.info?.reason) {
					console.log(`     → ${result.info.reason}`);
				}
			});

			// Calculate overall score
			const scores = Object.values(response.evalResults).map((r: any) => r.score);
			const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
			console.log(`\n📈 Overall Score: ${(avgScore * 100).toFixed(0)}%`);
		}
	} catch (error) {
		console.error("❌ Error:", error);
		process.exit(1);
	}
}

testAgent();
