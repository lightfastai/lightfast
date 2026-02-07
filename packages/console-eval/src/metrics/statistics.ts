/**
 * Statistical utilities for eval comparison
 *
 * Implements paired bootstrap test for comparing two eval runs.
 */

/**
 * Calculate mean
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
export function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Cohen's d effect size
 *
 * Measures magnitude of difference between two groups.
 * |d| < 0.2: small, 0.2-0.5: medium, > 0.5: large
 */
export function cohensD(group1: number[], group2: number[]): number {
  const mean1 = mean(group1);
  const mean2 = mean(group2);
  const sd1 = stdDev(group1);
  const sd2 = stdDev(group2);
  const pooledSD = Math.sqrt((sd1 ** 2 + sd2 ** 2) / 2);

  if (pooledSD === 0) return 0;
  return (mean2 - mean1) / pooledSD;
}

/**
 * Bootstrap resample with replacement
 */
export function bootstrapResample<T>(data: T[], seed?: number): T[] {
  const n = data.length;
  const resampled: T[] = [];

  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * n);
    const item = data[idx];
    if (item !== undefined) {
      resampled.push(item);
    }
  }

  return resampled;
}

/**
 * Paired Bootstrap Test
 *
 * Tests if candidate is significantly better than baseline.
 * Uses paired differences to reduce variance.
 *
 * Returns:
 * - pValue: probability that improvement is due to chance
 * - ci95: 95% confidence interval for the difference
 */
export function pairedBootstrapTest(
  baselineScores: number[],
  candidateScores: number[],
  numBootstrap: number = 10000,
  alpha: number = 0.05
): { pValue: number; ci95: [number, number] } {
  if (baselineScores.length !== candidateScores.length) {
    throw new Error("Baseline and candidate must have same length");
  }

  // 1. Compute observed delta
  const observedDelta = mean(candidateScores) - mean(baselineScores);

  // 2. Bootstrap: resample paired differences with replacement
  const deltas: number[] = [];
  const pairedDiffs = candidateScores.map((c, i) => c - (baselineScores[i] ?? 0));

  for (let b = 0; b < numBootstrap; b++) {
    const resampled = bootstrapResample(pairedDiffs);
    deltas.push(mean(resampled));
  }

  // 3. p-value: fraction of bootstrap deltas <= 0 (one-tailed test)
  // We're testing H0: candidate <= baseline, H1: candidate > baseline
  const pValue = deltas.filter(d => d <= 0).length / numBootstrap;

  // 4. Confidence interval
  deltas.sort((a, b) => a - b);
  const lowerIdx = Math.floor(numBootstrap * (alpha / 2));
  const upperIdx = Math.floor(numBootstrap * (1 - alpha / 2));
  const ci95: [number, number] = [deltas[lowerIdx] ?? 0, deltas[upperIdx] ?? 0];

  return { pValue, ci95 };
}

/**
 * Compute confidence interval for a metric
 */
export function confidenceInterval(
  values: number[],
  confidence: number = 0.95
): [number, number] {
  if (values.length === 0) return [0, 0];

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const alpha = 1 - confidence;

  const lowerIdx = Math.floor(n * (alpha / 2));
  const upperIdx = Math.floor(n * (1 - alpha / 2));

  return [sorted[lowerIdx] ?? 0, sorted[upperIdx] ?? 0];
}
