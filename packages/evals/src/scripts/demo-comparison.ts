#!/usr/bin/env tsx

/**
 * Demo script to show comparison functionality
 */

import { type ExperimentResult, ExperimentTracker } from "../lib/experiment-tracker";

const tracker = new ExperimentTracker("a011");

// Create a simulated improved experiment result
const improvedResult: ExperimentResult = {
	experimentName: "a011-improved-version",
	gitCommit: "abc123",
	timestamp: new Date().toISOString(),
	agent: "a011",
	scores: {
		test_0: {
			task_completion: 0.9, // Improved from 0.7
			output_quality: 0.5, // Improved from 0.3
			relevancy: 0.3, // Improved from 0
			error_handling: 1, // Same
			tool_usage_accuracy: 0.9, // Improved from 0.8
			performance: 0.7, // Improved from 0.5
			task_management: 1.0, // Improved from 0.5
		},
		test_1: {
			task_completion: 0.8, // Improved from 0.7
			output_quality: 0.9, // Slight regression from 1.0
			relevancy: 0.4, // Improved from 0
			error_handling: 1, // Same
			tool_usage_accuracy: 0.7, // Slight regression from 0.8
			performance: 0.6, // Improved from 0.5
			task_management: 0.8, // Improved from 0.5
		},
	},
	aggregateScores: {
		test_0: 0.771,
		test_1: 0.743,
	},
	overallAggregate: 0.757, // Improved from 0.593
	metadata: {
		version: "2.2.0",
		framework: "mastra",
		testCases: 2,
	},
};

// Save the improved result
tracker.saveResults(improvedResult);

// Compare to baseline
console.log("\n🎯 Demonstrating Comparison Functionality\n");
const comparison = tracker.compareToBaseline(improvedResult);
tracker.printComparison(comparison);

// Show recent experiments
console.log("\n📈 Recent Experiments:");
const recent = tracker.getRecentExperiments(5);
for (const exp of recent) {
	const isBaseline = exp.experimentName === "a011-2025-07-21" && exp.timestamp === "2025-07-21T11:20:33.726Z";
	const marker = isBaseline ? " (baseline)" : "";
	console.log(`   ${exp.experimentName} - Aggregate: ${exp.overallAggregate.toFixed(3)}${marker}`);
}
