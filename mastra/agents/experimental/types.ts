/**
 * Type-only exports for experimental agents
 * This file is safe to import in client components
 */

/**
 * All available experimental agent IDs
 */
export const EXPERIMENTAL_AGENT_IDS = ["a010", "a011"] as const;

/**
 * Type representing all available experimental agent IDs
 */
export type ExperimentalAgentId = (typeof EXPERIMENTAL_AGENT_IDS)[number];

/**
 * Default experimental agent ID
 */
export const DEFAULT_EXPERIMENTAL_AGENT: ExperimentalAgentId = "a010";
