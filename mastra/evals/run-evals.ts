#!/usr/bin/env tsx

import { writeFileSync } from "fs";
import { join } from "path";
import { runSafetyEvals, runV1AgentEvals } from "./v1-agent-evals";

/**
 * V1 Agent Eval Runner
 *
 * Run this script to execute all evaluation tests for the V1 agent
 * Usage: pnpm tsx mastra/evals/run-evals.ts
 */

async function main() {
	console.log("🧪 Starting V1 Agent Evaluation Suite\n");

	const startTime = Date.now();
	const results = {
		timestamp: new Date().toISOString(),
		functionalTests: null as any,
		safetyTests: null as any,
		summary: {
			totalTests: 0,
			passed: 0,
			failed: 0,
			avgScore: 0,
		},
	};

	try {
		// Run functional evals
		console.log("📊 Running Functional Evaluations...\n");
		results.functionalTests = await runV1AgentEvals();

		// Run safety evals
		console.log("\n🛡️  Running Safety Evaluations...\n");
		results.safetyTests = await runSafetyEvals();

		// Calculate summary
		const functionalPassed = results.functionalTests.filter((t) => t.passed).length;
		const safetyPassed =
			results.safetyTests.jailbreak.filter((t) => t.passed).length +
			results.safetyTests.bias.filter((t) => t.passed).length +
			results.safetyTests.toxicity.filter((t) => t.passed).length;

		results.summary.totalTests =
			results.functionalTests.length +
			results.safetyTests.jailbreak.length +
			results.safetyTests.bias.length +
			results.safetyTests.toxicity.length;

		results.summary.passed = functionalPassed + safetyPassed;
		results.summary.failed = results.summary.totalTests - results.summary.passed;

		// Calculate average scores
		const allScores = [];
		results.functionalTests.forEach((test) => {
			if (test.evalScores) {
				Object.values(test.evalScores).forEach((score: any) => {
					if (score?.score) allScores.push(score.score);
				});
			}
		});

		results.summary.avgScore = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

		// Print results
		console.log("\n📈 Evaluation Results Summary");
		console.log("=============================");
		console.log(`Total Tests: ${results.summary.totalTests}`);
		console.log(`Passed: ${results.summary.passed} ✅`);
		console.log(`Failed: ${results.summary.failed} ❌`);
		console.log(`Average Score: ${(results.summary.avgScore * 100).toFixed(1)}%`);
		console.log(`Time Taken: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

		// Save detailed results
		const outputPath = join(process.cwd(), "mastra/evals/results", `eval-results-${Date.now()}.json`);
		writeFileSync(outputPath, JSON.stringify(results, null, 2));
		console.log(`\n💾 Detailed results saved to: ${outputPath}`);

		// Print detailed functional test results
		console.log("\n📋 Functional Test Details:");
		results.functionalTests.forEach((test) => {
			const status = test.passed ? "✅" : "❌";
			console.log(`  ${status} ${test.scenario}`);
			if (test.keywordCoverage !== undefined) {
				console.log(`     Keyword Coverage: ${(test.keywordCoverage * 100).toFixed(0)}%`);
			}
			if (test.evalScores) {
				Object.entries(test.evalScores).forEach(([metric, score]: [string, any]) => {
					console.log(`     ${metric}: ${(score.score * 100).toFixed(0)}%`);
				});
			}
			if (test.error) {
				console.log(`     Error: ${test.error}`);
			}
		});

		// Print safety test summary
		console.log("\n🛡️  Safety Test Summary:");
		console.log(
			`  Jailbreak Resistance: ${results.safetyTests.jailbreak.filter((t) => t.passed).length}/${results.safetyTests.jailbreak.length} passed`,
		);
		console.log(
			`  Bias Tests: ${results.safetyTests.bias.filter((t) => t.passed).length}/${results.safetyTests.bias.length} passed`,
		);
		console.log(
			`  Toxicity Tests: ${results.safetyTests.toxicity.filter((t) => t.passed).length}/${results.safetyTests.toxicity.length} passed`,
		);

		// Exit with appropriate code
		process.exit(results.summary.failed > 0 ? 1 : 0);
	} catch (error) {
		console.error("\n❌ Evaluation failed with error:", error);
		process.exit(1);
	}
}

// Run evaluations
main().catch(console.error);
