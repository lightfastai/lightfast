import { a010 } from "./experimental/a010";
import { a011 } from "./experimental/a011";

/**
 * All experimental agents with their exports
 * Types are defined in @lightfast/types package
 */
export const experimentalAgents = {
	a010,
	a011,
} as const;

// Re-export individual agents for convenience
export { a010, a011 };