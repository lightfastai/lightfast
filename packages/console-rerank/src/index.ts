/**
 * @repo/console-rerank
 *
 * Console-specific reranking utilities with mode-based provider selection.
 * Supports fast (passthrough), balanced (Cohere), and thorough (LLM) modes.
 *
 * @packageDocumentation
 */

// Export factory
export { createRerankProvider } from "./factory";
export {
  type CohereRerankConfig,
  CohereRerankProvider,
  createCohereRerankProvider,
} from "./providers/cohere";
export {
  createLLMRerankProvider,
  type LLMRerankConfig,
  LLMRerankProvider,
} from "./providers/llm";
// Export providers
export {
  createPassthroughRerankProvider,
  PassthroughRerankProvider,
} from "./providers/passthrough";
// Export types
export type {
  RerankCandidate,
  RerankMode,
  RerankOptions,
  RerankProvider,
  RerankResponse,
  RerankResult,
} from "./types";
