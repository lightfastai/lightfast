/**
 * Metrics library for AI evaluation
 */

export type { RetrievalResult, RetrievalMetrics } from "./retrieval";
export {
  calculateMRR,
  calculateRecallAtK,
  calculatePrecisionAtK,
  calculateNDCGAtK,
  computeRetrievalMetrics,
} from "./retrieval";

export type { RAGQualityMetrics } from "./rag-quality";
export {
  calculateFaithfulness,
  calculateCitationPrecision,
  calculateAnswerRelevancy,
  computeRAGQualityMetrics,
} from "./rag-quality";

export {
  mean,
  stdDev,
  cohensD,
  bootstrapResample,
  pairedBootstrapTest,
  confidenceInterval,
} from "./statistics";
