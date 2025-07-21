#!/usr/bin/env tsx

/**
 * CLI for managing experiment results and baselines
 */

import { ExperimentTracker } from "../lib/experiment-tracker";

const agent = process.argv[2] || "a011";
const command = process.argv[3];
const arg = process.argv[4];

const tracker = new ExperimentTracker(agent);

function printUsage() {
	console.log(`
📊 Experiment Tracker CLI

Usage:
  pnpm tsx evals/scripts/experiment-cli.ts <agent> <command> [args]

Commands:
  list [n]              Show last n experiments (default: 10)
  baseline              Show current baseline
  set-baseline <name>   Set experiment as baseline
  compare <name>        Compare experiment to baseline
  clear-baseline        Remove baseline

Examples:
  pnpm tsx evals/scripts/experiment-cli.ts a011 list
  pnpm tsx evals/scripts/experiment-cli.ts a011 set-baseline a011-2024-01-21
  pnpm tsx evals/scripts/experiment-cli.ts a011 compare a011-2024-01-22
`);
}

switch (command) {
	case "list": {
		const limit = arg ? parseInt(arg) : 10;
		const experiments = tracker.getRecentExperiments(limit);

		console.log(`\n📊 Recent Experiments for ${agent}:`);
		console.log("=".repeat(60));

		if (experiments.length === 0) {
			console.log("No experiments found");
			break;
		}

		const baseline = tracker.getBaseline();

		for (const exp of experiments) {
			const isBaseline = baseline?.experimentName === exp.experimentName;
			const marker = isBaseline ? " 📌" : "";
			console.log(`\n${exp.experimentName}${marker}`);
			console.log(`  Commit:    ${exp.gitCommit}`);
			console.log(`  Timestamp: ${exp.timestamp}`);
			console.log(`  Aggregate: ${exp.overallAggregate.toFixed(3)}`);

			// Show dimension averages
			const dimensionTotals: Record<string, number> = {};
			let testCount = 0;

			for (const scores of Object.values(exp.scores)) {
				testCount++;
				for (const [dim, score] of Object.entries(scores)) {
					dimensionTotals[dim] = (dimensionTotals[dim] || 0) + score;
				}
			}

			if (testCount > 0) {
				console.log("  Dimensions:");
				for (const [dim, total] of Object.entries(dimensionTotals)) {
					console.log(`    ${dim}: ${(total / testCount).toFixed(3)}`);
				}
			}
		}
		break;
	}

	case "baseline": {
		const baseline = tracker.getBaseline();
		if (!baseline) {
			console.log("\n⚠️  No baseline set");
			console.log('Use "set-baseline <name>" to set one');
		} else {
			console.log(`\n📌 Current Baseline for ${agent}:`);
			console.log(`  Name:      ${baseline.experimentName}`);
			console.log(`  Commit:    ${baseline.gitCommit}`);
			console.log(`  Timestamp: ${baseline.timestamp}`);
			console.log(`  Aggregate: ${baseline.overallAggregate.toFixed(3)}`);
		}
		break;
	}

	case "set-baseline": {
		if (!arg) {
			console.error("\n❌ Please specify experiment name");
			printUsage();
			break;
		}

		if (tracker.setBaseline(arg)) {
			console.log(`\n✅ Baseline set successfully`);
		}
		break;
	}

	case "compare": {
		if (!arg) {
			console.error("\n❌ Please specify experiment name");
			printUsage();
			break;
		}

		const experiments = tracker.getRecentExperiments(100);
		const experiment = experiments.find((e) => e.experimentName === arg);

		if (!experiment) {
			console.error(`\n❌ Experiment ${arg} not found`);
			break;
		}

		const comparison = tracker.compareToBaseline(experiment);
		tracker.printComparison(comparison);
		break;
	}

	case "clear-baseline": {
		// Note: This would need to be added to ExperimentTracker
		console.log("\n⚠️  Clear baseline not implemented yet");
		break;
	}

	default: {
		if (command) {
			console.error(`\n❌ Unknown command: ${command}`);
		}
		printUsage();
	}
}
