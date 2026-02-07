/**
 * Tier 1 Retrieval Metrics
 *
 * Pure TypeScript implementations, no LLM calls, deterministic.
 * Based on information retrieval literature (Manning et al., 2008).
 */

export interface RetrievalResult {
  id: string;           // Observation externalId
  score: number;        // Relevance score from system (0-1)
  rank: number;         // Position in results (1-indexed)
}

export interface RetrievalMetrics {
  mrr: number;                          // Mean Reciprocal Rank
  recallAtK: Record<number, number>;    // K -> score
  precisionAtK: Record<number, number>;
  ndcgAtK: Record<number, number>;
  totalRelevant: number;
  totalRetrieved: number;
}

/**
 * Mean Reciprocal Rank (MRR)
 *
 * Score: 1 / rank of first relevant result
 * Range: [0, 1], higher is better
 */
export function calculateMRR(
  results: RetrievalResult[],
  relevant: Set<string>
): number {
  const firstRelevantRank = results.findIndex(r => relevant.has(r.id));

  if (firstRelevantRank === -1) {
    return 0; // No relevant results found
  }

  return 1 / (firstRelevantRank + 1); // Convert 0-indexed to 1-indexed
}

/**
 * Recall@K
 *
 * Fraction of relevant items found in top K results
 * Range: [0, 1], higher is better
 */
export function calculateRecallAtK(
  results: RetrievalResult[],
  relevant: Set<string>,
  k: number
): number {
  if (relevant.size === 0) return 0;

  const topK = results.slice(0, k);
  const found = topK.filter(r => relevant.has(r.id)).length;

  return found / relevant.size;
}

/**
 * Precision@K
 *
 * Fraction of top K results that are relevant
 * Range: [0, 1], higher is better
 */
export function calculatePrecisionAtK(
  results: RetrievalResult[],
  relevant: Set<string>,
  k: number
): number {
  if (k === 0) return 0;

  const topK = results.slice(0, k);
  const found = topK.filter(r => relevant.has(r.id)).length;

  return found / k;
}

/**
 * Normalized Discounted Cumulative Gain (NDCG@K)
 *
 * Ranking quality metric with position weighting.
 * Range: [0, 1], higher is better
 *
 * Formula: DCG@K / IDCG@K
 * where DCG@K = sum(rel_i / log2(i + 1)) for i in top K
 */
export function calculateNDCGAtK(
  results: RetrievalResult[],
  relevant: Set<string>,
  k: number,
  gradedRelevance?: Record<string, number> // observationId -> 0-3
): number {
  if (k === 0 || relevant.size === 0) return 0;

  const topK = results.slice(0, k);

  // DCG: Discounted Cumulative Gain
  let dcg = 0;
  for (let i = 0; i < topK.length; i++) {
    const result = topK[i];
    if (!result) continue;
    const relevance = gradedRelevance?.[result.id] ?? (relevant.has(result.id) ? 1 : 0);
    dcg += relevance / Math.log2(i + 2); // i+2 because i is 0-indexed
  }

  // IDCG: Ideal DCG (if all relevant docs were at top)
  const sortedRelevance = Array.from(relevant)
    .map(id => gradedRelevance?.[id] ?? 1)
    .sort((a, b) => b - a) // Descending
    .slice(0, k);

  let idcg = 0;
  for (let i = 0; i < sortedRelevance.length; i++) {
    const val = sortedRelevance[i];
    if (val !== undefined) {
      idcg += val / Math.log2(i + 2);
    }
  }

  return idcg === 0 ? 0 : dcg / idcg;
}

/**
 * Compute all retrieval metrics for a single case
 */
export function computeRetrievalMetrics(
  results: RetrievalResult[],
  relevant: Set<string>,
  kValues: number[] = [3, 5, 10],
  gradedRelevance?: Record<string, number>
): RetrievalMetrics {
  const recallAtK: Record<number, number> = {};
  const precisionAtK: Record<number, number> = {};
  const ndcgAtK: Record<number, number> = {};

  for (const k of kValues) {
    recallAtK[k] = calculateRecallAtK(results, relevant, k);
    precisionAtK[k] = calculatePrecisionAtK(results, relevant, k);
    ndcgAtK[k] = calculateNDCGAtK(results, relevant, k, gradedRelevance);
  }

  return {
    mrr: calculateMRR(results, relevant),
    recallAtK,
    precisionAtK,
    ndcgAtK,
    totalRelevant: relevant.size,
    totalRetrieved: results.length,
  };
}
