/**
 * Experiment Comparison
 *
 * Compares two eval runs with statistical rigor.
 */

import type { EvalRunResult } from "./runner";
import {
  mean,
  cohensD,
  pairedBootstrapTest,
  confidenceInterval
} from "../metrics/statistics";

export interface MetricSummary {
  mean: number;
  median: number;
  p95: number;
  ci95: [number, number];
  n: number;
}

export interface ComparisonResult {
  metric: string;
  baseline: MetricSummary;
  candidate: MetricSummary;
  delta: number;                      // candidate.mean - baseline.mean
  deltaPercent: number;               // delta / baseline.mean * 100
  pValue: number;                     // Paired bootstrap p-value
  effectSize: number;                 // Cohen's d
  isRegression: boolean;              // delta < threshold AND p < 0.05
  isImprovement: boolean;             // delta > 0 AND p < 0.05
  isStatisticallySignificant: boolean; // p < 0.05
}

/**
 * Regression thresholds per metric
 *
 * These define the maximum acceptable degradation.
 * Values are deltas (negative = worse for most metrics).
 */
export const REGRESSION_THRESHOLDS = {
  // Tier 1: Retrieval — allow max 5% drop
  "mrr": -0.05,
  "recall@3": -0.05,
  "recall@5": -0.05,
  "recall@10": -0.05,
  "precision@3": -0.05,
  "precision@5": -0.05,
  "precision@10": -0.05,
  "ndcg@3": -0.05,
  "ndcg@5": -0.05,
  "ndcg@10": -0.05,

  // Tier 2: RAG Quality — stricter, 3% max drop
  "faithfulness": -0.03,
  "citation_precision": -0.03,
  "citation_recall": -0.05,
  "answer_relevancy": -0.05,
  "hallucination_rate": 0.02, // Positive = worse (higher hallucination)

  // Latency — allow max 100ms increase at p95
  "latency_p95_ms": 100,
} as const;

/**
 * Compute summary statistics for a metric
 */
function computeSummary(values: number[]): MetricSummary {
  if (values.length === 0) {
    return { mean: 0, median: 0, p95: 0, ci95: [0, 0], n: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;

  return {
    mean: mean(values),
    median,
    p95,
    ci95: confidenceInterval(values, 0.95),
    n: values.length,
  };
}

/**
 * Compare two eval runs
 */
export function compareEvalRuns(
  baseline: EvalRunResult,
  candidate: EvalRunResult
): ComparisonResult[] {
  const comparisons: ComparisonResult[] = [];

  // Extract per-case scores for each metric
  const baselineScores = {
    mrr: baseline.perCase.map(c => c.metrics.mrr),
    "recall@3": baseline.perCase.map(c => c.metrics.recallAtK[3] ?? 0),
    "recall@5": baseline.perCase.map(c => c.metrics.recallAtK[5] ?? 0),
    "recall@10": baseline.perCase.map(c => c.metrics.recallAtK[10] ?? 0),
    "precision@5": baseline.perCase.map(c => c.metrics.precisionAtK[5] ?? 0),
    "ndcg@5": baseline.perCase.map(c => c.metrics.ndcgAtK[5] ?? 0),
    "latency_p95_ms": [baseline.perCase.map(c => c.latencyMs).sort((a, b) => a - b)[Math.floor(baseline.perCase.length * 0.95)] ?? 0],
  };

  const candidateScores = {
    mrr: candidate.perCase.map(c => c.metrics.mrr),
    "recall@3": candidate.perCase.map(c => c.metrics.recallAtK[3] ?? 0),
    "recall@5": candidate.perCase.map(c => c.metrics.recallAtK[5] ?? 0),
    "recall@10": candidate.perCase.map(c => c.metrics.recallAtK[10] ?? 0),
    "precision@5": candidate.perCase.map(c => c.metrics.precisionAtK[5] ?? 0),
    "ndcg@5": candidate.perCase.map(c => c.metrics.ndcgAtK[5] ?? 0),
    "latency_p95_ms": [candidate.perCase.map(c => c.latencyMs).sort((a, b) => a - b)[Math.floor(candidate.perCase.length * 0.95)] ?? 0],
  };

  // Compare each metric
  for (const [metricName, baselineValues] of Object.entries(baselineScores)) {
    const candidateValues = candidateScores[metricName as keyof typeof candidateScores];

    const baselineSummary = computeSummary(baselineValues);
    const candidateSummary = computeSummary(candidateValues);

    const delta = candidateSummary.mean - baselineSummary.mean;
    const deltaPercent = baselineSummary.mean === 0 ? 0 : (delta / baselineSummary.mean) * 100;

    // Statistical test
    const { pValue, ci95 } = pairedBootstrapTest(baselineValues, candidateValues);
    const effectSize = cohensD(baselineValues, candidateValues);

    // Regression check
    const threshold = REGRESSION_THRESHOLDS[metricName as keyof typeof REGRESSION_THRESHOLDS] ?? -0.05;
    const isRegression = delta < threshold && pValue < 0.05;
    const isImprovement = delta > 0 && pValue < 0.05;

    comparisons.push({
      metric: metricName,
      baseline: baselineSummary,
      candidate: candidateSummary,
      delta,
      deltaPercent,
      pValue,
      effectSize,
      isRegression,
      isImprovement,
      isStatisticallySignificant: pValue < 0.05,
    });
  }

  return comparisons;
}

/**
 * Format comparison results as markdown table
 */
export function formatComparisonReport(comparisons: ComparisonResult[]): string {
  let report = "# Eval Comparison Report\n\n";
  report += "| Metric | Baseline | Candidate | Delta | Delta % | p-value | Effect Size | Status |\n";
  report += "|--------|----------|-----------|-------|---------|---------|-------------|--------|\n";

  for (const c of comparisons) {
    const statusEmoji = c.isRegression ? "🔴" : c.isImprovement ? "🟢" : "⚪";
    report += `| ${c.metric} | ${c.baseline.mean.toFixed(3)} | ${c.candidate.mean.toFixed(3)} | `;
    report += `${c.delta > 0 ? "+" : ""}${c.delta.toFixed(3)} | `;
    report += `${c.deltaPercent > 0 ? "+" : ""}${c.deltaPercent.toFixed(1)}% | `;
    report += `${c.pValue.toFixed(3)} | ${c.effectSize.toFixed(2)} | ${statusEmoji} |\n`;
  }

  // Summary
  const regressions = comparisons.filter(c => c.isRegression);
  const improvements = comparisons.filter(c => c.isImprovement);

  report += "\n## Summary\n\n";
  report += `- **Regressions**: ${regressions.length}\n`;
  report += `- **Improvements**: ${improvements.length}\n`;
  report += `- **No significant change**: ${comparisons.length - regressions.length - improvements.length}\n`;

  if (regressions.length > 0) {
    report += "\n### ⚠️ Regressions Detected\n\n";
    for (const r of regressions) {
      report += `- **${r.metric}**: ${r.deltaPercent.toFixed(1)}% drop (p=${r.pValue.toFixed(3)})\n`;
    }
  }

  return report;
}
