import { z } from "zod";

/** Priority determines ordering and trimming behavior */
export const PromptSectionPriority = z.enum([
	"critical", // Never trimmed (identity, security)
	"high", // Trimmed only under extreme pressure (capabilities, tools)
	"medium", // Trimmed when context is large (user context, temporal)
	"low", // First to trim (style details, examples)
]);
export type PromptSectionPriority = z.infer<typeof PromptSectionPriority>;

/** A composable section of the system prompt */
export interface PromptSection {
	/** Unique section identifier */
	id: string;
	/** Section priority for token budgeting */
	priority: PromptSectionPriority;
	/** Generate the section content */
	render(): string;
	/** Estimated token count (for budgeting before rendering) */
	estimateTokens(): number;
}

/** Feature flags for optional prompt sections */
export interface PromptFeatureFlags {
	/** Enable temporal context section (default: false) */
	temporalContext?: boolean;
	/** Enable communication style section (default: true) */
	style?: boolean;
	/** Enable per-tool guidance section (default: true) */
	toolGuidance?: boolean;
	/** Enable user/workspace context section (default: false) */
	userContext?: boolean;
}

/** Default feature flags */
export const DEFAULT_FEATURE_FLAGS: Required<PromptFeatureFlags> = {
	temporalContext: false,
	style: true,
	toolGuidance: true,
	userContext: false,
};

/** Communication style options */
export const CommunicationStyleSchema = z.enum([
	"formal",
	"concise",
	"technical",
	"friendly",
]);
export type CommunicationStyle = z.infer<typeof CommunicationStyleSchema>;

/** Temporal context — time grounding for the model */
export interface TemporalContext {
	/** ISO 8601 timestamp */
	currentTimestamp: string;
}

/** User context — workspace info (future: preferences, activity) */
export interface UserContext {
	workspace?: {
		name: string;
		description?: string;
		repos: string[];
		integrations: string[];
	};
}

/**
 * Input context available to all section providers.
 *
 * To add a new context type, add an optional field here
 * alongside a corresponding feature flag in PromptFeatureFlags.
 */
export interface PromptContext {
	auth: {
		isAnonymous: boolean;
		userId: string;
		clerkUserId: string | null;
	};
	billing: {
		plan: string;
		limits: Record<string, unknown>;
	};
	model: {
		id: string;
		provider: string;
		maxOutputTokens: number;
	};
	activeTools: string[];
	webSearchEnabled: boolean;
	/** Feature flags — resolved with defaults before reaching sections */
	features: Required<PromptFeatureFlags>;
	/** Communication style (only used when features.style is true) */
	style: CommunicationStyle;
	/** Temporal context (only used when features.temporalContext is true) */
	temporalContext?: TemporalContext;
	/** User/workspace context (only used when features.userContext is true) */
	userContext?: UserContext;
}

/** Section provider: a function that creates PromptSections from context */
export type SectionProvider = (context: PromptContext) => PromptSection | null;
