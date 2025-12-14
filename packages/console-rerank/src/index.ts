/**
 * @repo/console-rerank
 *
 * Console-specific reranking utilities with mode-based provider selection.
 * Supports fast (passthrough), balanced (Cohere), and thorough (LLM) modes.
 *
 * @packageDocumentation
 */

// Export types
export type {
  RerankProvider,
  RerankCandidate,
  RerankResult,
  RerankResponse,
  RerankOptions,
  RerankMode,
} from "./types";

// Export factory
export { createRerankProvider } from "./factory";

// Export providers
export {
  PassthroughRerankProvider,
  createPassthroughRerankProvider,
} from "./providers/passthrough";

export {
  CohereRerankProvider,
  createCohereRerankProvider,
  type CohereRerankConfig,
} from "./providers/cohere";

export {
  LLMRerankProvider,
  createLLMRerankProvider,
  type LLMRerankConfig,
} from "./providers/llm";
