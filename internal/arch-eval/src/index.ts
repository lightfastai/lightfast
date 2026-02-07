import { loadConfig } from "./config.js";
import { runAllCollectors } from "./collectors/index.js";
import { analyzeAll } from "./analyzers/index.js";
import { generateJsonReport } from "./reporters/json-reporter.js";
import { generateMarkdownReport } from "./reporters/markdown-reporter.js";

async function main() {
  const args = process.argv.slice(2);
  const isQuick = args.includes("--quick");
  const isCompare = args.includes("--compare");

  console.log("Architecture Evaluation Pipeline");
  console.log("================================\n");

  // Load config
  const config = loadConfig();
  console.log(`Dimensions: ${config.dimensions.join(", ")}`);
  console.log(`Feature flags: ${JSON.stringify(config.feature_flags)}\n`);

  // Stage 1: Collect
  console.log("Stage 1: Collecting data...");
  const collectorOutputs = await runAllCollectors(config, { quick: isQuick });

  for (const output of collectorOutputs) {
    console.log(
      `  ${output.tool}: ${output.raw_findings.length} raw findings (${output.duration_ms}ms)`
    );
  }

  // Stage 2: Analyze
  console.log("\nStage 2: Analyzing findings...");
  const findings = analyzeAll(collectorOutputs, config);
  console.log(`  Total findings: ${findings.length}`);
  console.log(`  Tier 1: ${findings.filter((f) => f.tier === 1).length}`);
  console.log(`  Tier 2: ${findings.filter((f) => f.tier === 2).length}`);
  console.log(`  Tier 3: ${findings.filter((f) => f.tier === 3).length}`);

  // Stage 3: Report
  console.log("\nStage 3: Generating reports...");
  const result = generateJsonReport(findings, collectorOutputs);
  const markdownPath = generateMarkdownReport(result, { compare: isCompare });

  console.log(`\nJSON results: thoughts/shared/evaluations/results/`);
  console.log(`Markdown summary: ${markdownPath.replace(process.cwd(), ".")}`);
  console.log(
    `\nSignal ratio: ${(result.summary.signal_ratio * 100).toFixed(0)}%`
  );

  // Exit with error if Tier 1 findings exist
  if (result.summary.tier1_count > 0) {
    console.log(
      `\n❌ ${result.summary.tier1_count} critical finding(s) — see report for details.`
    );
    process.exit(1);
  }

  console.log("\n✅ No critical findings. Pipeline complete.");
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(2);
});
