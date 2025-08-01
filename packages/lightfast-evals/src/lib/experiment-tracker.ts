/**
 * Simple experiment tracking for offline evaluations
 * Stores results and enables comparison over time
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export interface ExperimentResult {
	experimentName: string;
	gitCommit: string;
	timestamp: string;
	agent: string;
	scores: {
		[testCaseName: string]: {
			[dimension: string]: number;
		};
	};
	aggregateScores: {
		[testCaseName: string]: number;
	};
	overallAggregate: number;
	metadata?: Record<string, unknown>;
}

export interface ExperimentComparison {
	current: ExperimentResult;
	baseline?: ExperimentResult;
	improvements: Array<{ dimension: string; current: number; baseline: number; delta: number }>;
	regressions: Array<{ dimension: string; current: number; baseline: number; delta: number }>;
	aggregateDelta?: number;
}

export class ExperimentTracker {
	private resultsDir: string;
	private resultsFile: string;
	private baselineFile: string;

	constructor(agent: string) {
		this.resultsDir = join(process.cwd(), "packages", "evals", "src", "results");
		this.resultsFile = join(this.resultsDir, `${agent}-results.json`);
		this.baselineFile = join(this.resultsDir, `${agent}-baseline.json`);

		// Ensure results directory exists
		if (!existsSync(this.resultsDir)) {
			mkdirSync(this.resultsDir, { recursive: true });
		}
	}

	/**
	 * Save experiment results
	 */
	saveResults(result: ExperimentResult): void {
		// Load existing results
		const history = this.loadHistory();

		// Add new result
		history.push(result);

		// Keep last 100 results
		if (history.length > 100) {
			history.shift();
		}

		// Save updated history
		writeFileSync(this.resultsFile, JSON.stringify(history, null, 2));
		console.log(`\n💾 Saved experiment results to ${this.resultsFile}`);
	}

	/**
	 * Load experiment history
	 */
	loadHistory(): ExperimentResult[] {
		if (!existsSync(this.resultsFile)) {
			return [];
		}

		try {
			const data = readFileSync(this.resultsFile, "utf-8");
			return JSON.parse(data) as ExperimentResult[];
		} catch (error) {
			console.error(`Failed to load history: ${error}`);
			return [];
		}
	}

	/**
	 * Set baseline experiment
	 */
	setBaseline(experimentName: string): boolean {
		const history = this.loadHistory();
		const experiment = history.find((e) => e.experimentName === experimentName);

		if (!experiment) {
			console.error(`Experiment ${experimentName} not found`);
			return false;
		}

		writeFileSync(this.baselineFile, JSON.stringify(experiment, null, 2));
		console.log(`✅ Set ${experimentName} as baseline`);
		return true;
	}

	/**
	 * Get baseline experiment
	 */
	getBaseline(): ExperimentResult | null {
		if (!existsSync(this.baselineFile)) {
			return null;
		}

		try {
			const data = readFileSync(this.baselineFile, "utf-8");
			return JSON.parse(data) as ExperimentResult;
		} catch (error) {
			console.error(`Failed to load baseline: ${error}`);
			return null;
		}
	}

	/**
	 * Compare current results to baseline
	 */
	compareToBaseline(current: ExperimentResult): ExperimentComparison {
		const baseline = this.getBaseline();
		const comparison: ExperimentComparison = {
			current,
			baseline: baseline || undefined,
			improvements: [],
			regressions: [],
		};

		if (!baseline) {
			return comparison;
		}

		// Compare aggregate scores
		if (current.overallAggregate && baseline.overallAggregate) {
			comparison.aggregateDelta = current.overallAggregate - baseline.overallAggregate;
		}

		// Compare individual dimensions across all test cases
		const dimensionScores: Record<string, { current: number; baseline: number }> = {};

		// Aggregate scores across test cases for each dimension
		for (const [testCase, scores] of Object.entries(current.scores)) {
			for (const [dimension, score] of Object.entries(scores)) {
				if (!dimensionScores[dimension]) {
					dimensionScores[dimension] = { current: 0, baseline: 0 };
				}
				dimensionScores[dimension].current += score;
			}
		}

		// Get baseline scores
		if (baseline.scores) {
			for (const [testCase, scores] of Object.entries(baseline.scores)) {
				for (const [dimension, score] of Object.entries(scores)) {
					if (!dimensionScores[dimension]) {
						dimensionScores[dimension] = { current: 0, baseline: 0 };
					}
					dimensionScores[dimension].baseline += score;
				}
			}
		}

		// Calculate averages and compare
		const testCaseCount = Object.keys(current.scores).length;
		for (const [dimension, scores] of Object.entries(dimensionScores)) {
			const currentAvg = scores.current / testCaseCount;
			const baselineAvg = scores.baseline / testCaseCount;
			const delta = currentAvg - baselineAvg;

			if (delta > 0.01) {
				// Improvement threshold
				comparison.improvements.push({
					dimension,
					current: currentAvg,
					baseline: baselineAvg,
					delta,
				});
			} else if (delta < -0.01) {
				// Regression threshold
				comparison.regressions.push({
					dimension,
					current: currentAvg,
					baseline: baselineAvg,
					delta,
				});
			}
		}

		return comparison;
	}

	/**
	 * Print comparison results
	 */
	printComparison(comparison: ExperimentComparison): void {
		console.log("\n📊 Experiment Comparison Results");
		console.log("================================");

		if (!comparison.baseline) {
			console.log("⚠️  No baseline set - run with --set-baseline to establish one");
			return;
		}

		console.log(`\n📌 Baseline: ${comparison.baseline.experimentName}`);
		console.log(`🔬 Current:  ${comparison.current.experimentName}`);

		if (comparison.aggregateDelta !== undefined) {
			const delta = comparison.aggregateDelta;
			const emoji = delta > 0 ? "📈" : delta < 0 ? "📉" : "➡️";
			const sign = delta > 0 ? "+" : "";
			console.log(
				`\n${emoji} Aggregate Score: ${comparison.current.overallAggregate.toFixed(3)} (${sign}${delta.toFixed(3)})`,
			);
		}

		if (comparison.improvements.length > 0) {
			console.log("\n✅ Improvements:");
			for (const imp of comparison.improvements) {
				console.log(`   ${imp.dimension}: ${imp.current.toFixed(3)} (+${imp.delta.toFixed(3)})`);
			}
		}

		if (comparison.regressions.length > 0) {
			console.log("\n❌ Regressions:");
			for (const reg of comparison.regressions) {
				console.log(`   ${reg.dimension}: ${reg.current.toFixed(3)} (${reg.delta.toFixed(3)})`);
			}
		}

		if (comparison.improvements.length === 0 && comparison.regressions.length === 0) {
			console.log("\n➡️  No significant changes detected");
		}

		console.log("\n================================");
	}

	/**
	 * Get recent experiments
	 */
	getRecentExperiments(limit: number = 10): ExperimentResult[] {
		const history = this.loadHistory();
		return history.slice(-limit);
	}
}
