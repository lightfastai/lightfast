/**
 * @repo/console-search
 *
 * Neural search pipeline extracted from apps/console for reuse in eval and other packages.
 *
 * @packageDocumentation
 */

// Types
export type { V1AuthContext } from "./types";

// Search orchestration
export {
  searchLogic,
  type SearchLogicInput,
  type SearchLogicOutput,
  type SearchLogicOptions,
} from "./search";

// Neural search internals (for contents.ts, findsimilar.ts, and eval)
export {
  fourPathParallelSearch,
  enrichSearchResults,
  type FourPathSearchParams,
  type FourPathSearchResult,
  type EnrichedResult,
} from "./neural/four-path-search";

export {
  buildSourceUrl,
} from "./neural/url-builder";

export {
  resolveByUrl,
  type ResolvedContent,
} from "./neural/url-resolver";

export {
  resolveObservationById,
  resolveObservationsById,
  isVectorId,
  getVectorIdView,
  type ResolvedObservation,
} from "./neural/id-resolver";

export {
  searchByEntities,
  extractQueryEntities,
} from "./neural/entity-search";

export {
  searchClusters,
  type ClusterSearchResult,
} from "./neural/cluster-search";

export {
  searchActorProfiles,
  type ActorSearchResult,
} from "./neural/actor-search";

export {
  llmRelevanceFilter,
  type FilterCandidate,
  type ScoredResult,
  type LLMFilterResult,
} from "./neural/llm-filter";

export {
  getStateAt,
  getCurrentState,
  getStateHistory,
  recordStateChange,
  getAllCurrentStates,
} from "./neural/temporal-state";
