#!/usr/bin/env node

import { Command } from "commander";
import { compareEvalRuns, formatComparisonReport } from "../eval/compare";
import { readFileSync, writeFileSync } from "node:fs";
import type { EvalRunResult } from "../eval/runner";

const program = new Command();

program
  .name("compare")
  .description("Compare two eval runs for regression detection")
  .requiredOption("-b, --baseline <path>", "Path to baseline eval result JSON")
  .requiredOption("-c, --candidate <path>", "Path to candidate eval result JSON")
  .option("-o, --output <path>", "Output report path", "eval-comparison-report.md")
  .action((options) => {
    console.log("Loading eval results...");

    const baseline: EvalRunResult = JSON.parse(readFileSync(options.baseline, "utf-8"));
    const candidate: EvalRunResult = JSON.parse(readFileSync(options.candidate, "utf-8"));

    console.log(`Baseline: ${baseline.perCase.length} cases`);
    console.log(`Candidate: ${candidate.perCase.length} cases`);

    console.log("\nRunning statistical comparison...");
    const comparisons = compareEvalRuns(baseline, candidate);

    const report = formatComparisonReport(comparisons);

    // Write report
    writeFileSync(options.output, report);
    console.log(`\nReport written to: ${options.output}`);

    // Print to console
    console.log("\n" + report);

    // Exit with error code if regressions detected
    const hasRegressions = comparisons.some(c => c.isRegression);
    if (hasRegressions) {
      console.error("\n❌ Regressions detected!");
      process.exit(1);
    } else {
      console.log("\n✅ No regressions detected");
      process.exit(0);
    }
  });

program.parse();
