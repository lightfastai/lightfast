/**
 * @repo/console-eval
 *
 * AI evaluation pipeline for Lightfast's neural search and answer systems.
 */

// Dataset schema
export type { EvalDataset, EvalCase, QueryType } from "./datasets/schema";
export { validateDataset, EvalDatasetSchema, EvalCaseSchema, QueryTypeSchema } from "./datasets/schema";

// Dataset generation
export { generateCorpus, CORPUS_TEMPLATES } from "./generation/corpus-generator";
export { generateQueries } from "./generation/query-generator";
export { scoreQuery, filterByCriticScores, type CriticScore } from "./generation/critic";
export { resolveGroundTruth, annotateWithGroundTruth, type GroundTruthMapping } from "./generation/ground-truth";

// Metrics
export type { RetrievalResult, RetrievalMetrics, RAGQualityMetrics } from "./metrics";
export {
  calculateMRR,
  calculateRecallAtK,
  calculatePrecisionAtK,
  calculateNDCGAtK,
  computeRetrievalMetrics,
  calculateFaithfulness,
  calculateCitationPrecision,
  calculateAnswerRelevancy,
  computeRAGQualityMetrics,
} from "./metrics";

// Eval runner
export type { EvalRunConfig, EvalRunResult } from "./eval/runner";
export { runEval } from "./eval/runner";

// Eval comparison
export type { ComparisonResult, MetricSummary } from "./eval/compare";
export { compareEvalRuns, formatComparisonReport, REGRESSION_THRESHOLDS } from "./eval/compare";

// Search client
export type { SearchConfig, SearchOptions, V1SearchResponse } from "./clients/search-client";
export { searchAPI } from "./clients/search-client";
